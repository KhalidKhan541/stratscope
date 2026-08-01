import io
import json
import logging
import os
import sys
import unittest.mock as mock
import urllib.error

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stratscope
from stratscope import StratScopeError, StratScopeExecution, start

BASE_URL = "https://stratscope-api.khalidkhan.workers.dev"


class FakeResponse:
    def __init__(self, status=201, payload=None):
        self.status = status
        self._body = b"" if payload is None else json.dumps(payload).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def fake_start_response(execution_id="exec_1", trace_id="tr_1"):
    return FakeResponse(
        201,
        {"success": True, "data": {"id": execution_id, "trace_id": trace_id, "status": "running"}},
    )


def http_error(url, code, message, body):
    return urllib.error.HTTPError(url, code, message, {}, io.BytesIO(body))


def body_of(request):
    return json.loads(request.data)


def test_module_exports():
    assert stratscope.start is start
    assert stratscope.StratScopeError is StratScopeError
    assert stratscope.StratScopeExecution is StratScopeExecution
    assert stratscope.__version__ == "0.1.0"
    assert isinstance(stratscope.__doc__, str) and stratscope.__doc__.strip()


def test_start_sends_expected_request():
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="test-key", project_id="proj_1", agent_id="agent_1")

    assert urlopen.call_count == 1
    request = urlopen.call_args.args[0]
    assert request.full_url == BASE_URL + "/v1/ingest/executions"
    assert request.get_method() == "POST"
    headers = {key.lower(): value for key, value in request.headers.items()}
    assert headers["authorization"] == "Bearer test-key"
    assert headers["content-type"] == "application/json"
    assert headers["user-agent"] == "stratscope-python/0.1.0"
    assert headers["x-stratscope-sdk"] == "python-0.1.0"
    assert body_of(request) == {
        "project_id": "proj_1",
        "agent_id": "agent_1",
        "sdk_version": "0.1.0",
    }
    assert execution.id == "exec_1"
    assert execution.trace_id == "tr_1"
    assert execution.project_id == "proj_1"
    assert execution.agent_id == "agent_1"
    assert isinstance(execution, StratScopeExecution)


def test_start_includes_optional_fields_and_custom_base_url():
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        start(
            api_key="k",
            base_url="https://example.com",
            project_id="p",
            agent_id="a",
            model="llama-3.3-70b",
            provider="groq",
            trace_id="trace-abc",
            metadata={"env": "prod"},
        )
    request = urlopen.call_args.args[0]
    assert request.full_url == "https://example.com/v1/ingest/executions"
    body = body_of(request)
    assert body["model"] == "llama-3.3-70b"
    assert body["provider"] == "groq"
    assert body["trace_id"] == "trace-abc"
    assert body["metadata"] == {"env": "prod"}


def test_start_requires_project_and_agent():
    with mock.patch("urllib.request.urlopen") as urlopen:
        with pytest.raises(ValueError):
            start(api_key="k", project_id="p")
        with pytest.raises(ValueError):
            start(api_key="k", agent_id="a")
        assert urlopen.call_count == 0


def test_events_buffer_and_flush_at_20():
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="k", project_id="p", agent_id="a")
        urlopen.reset_mock()
        for i in range(19):
            execution.event(f"evt_{i}", {"n": i})
        assert urlopen.call_count == 0
        execution.event("evt_19", {"n": 19}, metadata={"batch": "b1"})
        assert urlopen.call_count == 1
        request = urlopen.call_args.args[0]
        assert request.full_url == BASE_URL + "/v1/ingest/events"
        assert request.get_method() == "POST"
        batch = body_of(request)["batch"]
        assert len(batch) == 20
        assert batch[0] == {"event_type": "evt_0", "execution_id": "exec_1", "payload": {"n": 0}}
        assert batch[19] == {
            "event_type": "evt_19",
            "execution_id": "exec_1",
            "payload": {"n": 19},
            "metadata": {"batch": "b1"},
        }
        for i in range(20):
            execution.event(f"evt_{20 + i}", {"n": i})
        assert urlopen.call_count == 2
        second_batch = body_of(urlopen.call_args.args[0])["batch"]
        assert len(second_batch) == 20
        assert second_batch[0]["event_type"] == "evt_20"


def test_flush_chunks_batches_at_500():
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="k", project_id="p", agent_id="a")
        urlopen.reset_mock()
        urlopen.return_value = FakeResponse(201, {"success": True, "data": {"inserted": 0}})
        execution._buffer.extend(
            [{"event_type": f"e{i}", "execution_id": "exec_1", "payload": {}} for i in range(520)]
        )
        execution.finish(status="completed")

    requests = [c.args[0] for c in urlopen.call_args_list]
    assert [r.full_url for r in requests] == [
        BASE_URL + "/v1/ingest/events",
        BASE_URL + "/v1/ingest/events",
        BASE_URL + "/v1/ingest/executions/exec_1",
    ]
    assert len(body_of(requests[0])["batch"]) == 500
    assert len(body_of(requests[1])["batch"]) == 20
    assert requests[2].get_method() == "PATCH"


def test_finish_flushes_events_then_patches_with_stats():
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="k", project_id="p", agent_id="a")
        urlopen.reset_mock()
        execution.event("evt_1", {"step": 1})
        execution.event("evt_2", {"step": 2})
        execution.finish(
            status="completed",
            latency_ms=150,
            cost_usd=0.01,
            tokens_in=100,
            tokens_out=50,
        )

    requests = [c.args[0] for c in urlopen.call_args_list]
    assert len(requests) == 2
    assert requests[0].full_url == BASE_URL + "/v1/ingest/events"
    assert len(body_of(requests[0])["batch"]) == 2
    patch_request = requests[1]
    assert patch_request.full_url == BASE_URL + "/v1/ingest/executions/exec_1"
    assert patch_request.get_method() == "PATCH"
    assert body_of(patch_request) == {
        "status": "completed",
        "latency_ms": 150,
        "cost_usd": 0.01,
        "tokens_in": 100,
        "tokens_out": 50,
    }


def test_finish_omits_none_stats():
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="k", project_id="p", agent_id="a")
        urlopen.reset_mock()
        execution.finish(status="failed", error="boom")

    assert urlopen.call_count == 1
    patch_request = urlopen.call_args.args[0]
    assert patch_request.get_method() == "PATCH"
    assert body_of(patch_request) == {"status": "failed", "error": "boom"}


def test_network_failure_on_flush_does_not_raise_and_warns(caplog):
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="k", project_id="p", agent_id="a")
        urlopen.reset_mock()
        urlopen.side_effect = urllib.error.URLError("connection refused")
        with mock.patch("time.sleep") as sleep, caplog.at_level(logging.WARNING, logger="stratscope"):
            for i in range(20):
                execution.event(f"e{i}", {})

    assert urlopen.call_count == 2
    assert sleep.call_count == 1
    assert any("dropping payload" in record.message for record in caplog.records)


def test_start_network_failure_returns_local_execution(caplog):
    with mock.patch(
        "urllib.request.urlopen", side_effect=urllib.error.URLError("dns failure")
    ) as urlopen:
        with mock.patch("time.sleep") as sleep, caplog.at_level(logging.WARNING, logger="stratscope"):
            execution = start(api_key="k", project_id="p", agent_id="a")
            execution.event("e1", {})
            execution.finish(status="completed")

    assert urlopen.call_count == 2
    assert sleep.call_count == 1
    assert execution.id is None
    assert any("dropping payload" in record.message for record in caplog.records)


def test_event_flush_drops_on_server_error(caplog):
    error = http_error(
        BASE_URL + "/v1/ingest/events", 400, "Bad Request", b'{"success": false, "error": "bad payload"}'
    )
    with mock.patch("urllib.request.urlopen", return_value=fake_start_response()) as urlopen:
        execution = start(api_key="k", project_id="p", agent_id="a")
        urlopen.reset_mock()
        urlopen.side_effect = error
        with mock.patch("time.sleep"), caplog.at_level(logging.WARNING, logger="stratscope"):
            for i in range(20):
                execution.event(f"e{i}", {})

    assert urlopen.call_count == 2
    assert any("dropping payload" in record.message for record in caplog.records)


def test_start_server_error_raises_stratscope_error():
    error = http_error(
        BASE_URL + "/v1/ingest/executions",
        401,
        "Unauthorized",
        b'{"success": false, "error": "invalid api key"}',
    )
    with mock.patch("urllib.request.urlopen", side_effect=error) as urlopen:
        with pytest.raises(StratScopeError) as excinfo:
            start(api_key="bad", project_id="p", agent_id="a")

    assert urlopen.call_count == 1
    assert "invalid api key" in str(excinfo.value)
    assert "401" in str(excinfo.value)
