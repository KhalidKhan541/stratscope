"""Tests for daemon.worker. Git and GitHub calls are mocked; the fake runner
prints the bugfixer contract JSON line. No network."""

import sys
from pathlib import Path
from unittest import mock

from daemon import worker
from daemon.poller import DEFAULT_PROCESSED_LABEL

FAKE_RUNNER = Path(__file__).resolve().parent / "fake_runner.py"


def make_config(tmp_path, **overrides):
    values = {
        "token": "test-token",
        "bugfixer_cmd": [sys.executable, str(FAKE_RUNNER)],
        "work_root": tmp_path,
        "timeout_sec": 60,
    }
    values.update(overrides)
    return worker.WorkerConfig(**values)


def make_issue(number=7):
    return {"number": number, "title": "a bug"}


def test_worker_marks_processed_even_when_runner_fails(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_STATUS", "failed")
    monkeypatch.setenv("FAKE_EXIT_CODE", "1")
    monkeypatch.setenv("FAKE_TESTS_PASSED", "false")
    cfg = make_config(tmp_path)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path) as ensure_repo, mock.patch.object(
        worker.poller, "mark_processed"
    ) as mark_processed:
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["status"] == "failed"
    assert result["execution_id"] == "fake-exec-1"
    assert result["tests_passed"] is False
    assert result["marked_processed"] is True
    ensure_repo.assert_called_once_with(cfg, "owner", "repo")
    mark_processed.assert_called_once_with(
        "owner", "repo", 7, "test-token", label=DEFAULT_PROCESSED_LABEL
    )


def test_worker_completed(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_STATUS", "completed")
    cfg = make_config(tmp_path)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker.poller, "mark_processed"
    ):
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["status"] == "completed"
    assert result["execution_id"] == "fake-exec-1"
    assert result["tests_passed"] is True
    assert result["changes"] == 2
    assert result["marked_processed"] is True


def test_worker_dry_run_never_marks_or_comments(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_STATUS", "completed")
    cfg = make_config(tmp_path, dry_run=True)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker.poller, "mark_processed"
    ) as mark_processed, mock.patch.object(
        worker.github_api, "comment_on_issue"
    ) as comment_on_issue:
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["marked_processed"] is False
    mark_processed.assert_not_called()
    comment_on_issue.assert_not_called()


def test_worker_comments_when_enabled(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_STATUS", "completed")
    cfg = make_config(tmp_path, comment=True)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker.poller, "mark_processed"
    ), mock.patch.object(worker.github_api, "comment_on_issue") as comment_on_issue:
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["commented"] is True
    comment_on_issue.assert_called_once()
    call = comment_on_issue.call_args
    assert call.args[:3] == ("owner", "repo", 7)
    assert "fake-exec-1" in call.args[3]


def test_worker_checkout_failure_not_marked_and_never_raises(tmp_path):
    cfg = make_config(tmp_path)
    with mock.patch.object(worker, "ensure_repo", side_effect=RuntimeError("no network")):
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["status"] == "checkout_error"
    assert result["marked_processed"] is False
    assert "no network" in result["error"]


def test_worker_survives_mark_processed_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_STATUS", "completed")
    cfg = make_config(tmp_path)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker.poller, "mark_processed", side_effect=RuntimeError("api down")
    ):
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["status"] == "completed"
    assert result["marked_processed"] is False
    assert "api down" in result["mark_error"]


def test_worker_trusts_exit_code_over_json_status(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_STATUS", "completed")
    monkeypatch.setenv("FAKE_EXIT_CODE", "1")
    cfg = make_config(tmp_path)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker.poller, "mark_processed"
    ):
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["status"] == "failed"


def test_worker_unparseable_output_is_failure(tmp_path, monkeypatch):
    def bad_runner(*args, **kwargs):
        return mock.Mock(returncode=1, stdout="oops no json\n")

    cfg = make_config(tmp_path)
    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker, "run_bugfixer", side_effect=bad_runner
    ) as run_bugfixer:
        result = worker.process_issue(cfg, "owner", "repo", make_issue())
    assert result["status"] == "failed"
    assert "no parseable JSON" in result["error"]
    run_bugfixer.assert_called_once()


def test_worker_passes_issue_title_and_body_to_runner(tmp_path, monkeypatch):
    cfg = make_config(tmp_path)
    captured = {}

    def spy_runner(cfg, repo_dir, title, body):
        captured["title"] = title
        captured["body"] = body
        return mock.Mock(returncode=0, stdout='{"execution_id": "e-1", "status": "completed"}\n')

    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker, "run_bugfixer", side_effect=spy_runner
    ), mock.patch.object(worker.poller, "mark_processed"):
        issue = make_issue(number=9)
        issue["body"] = "repro steps here"
        worker.process_issue(cfg, "owner", "repo", issue)
    assert captured["title"] == "a bug"
    assert captured["body"] == "repro steps here"


def test_worker_missing_body_defaults_to_empty_string(tmp_path, monkeypatch):
    cfg = make_config(tmp_path)
    captured = {}

    def spy_runner(cfg, repo_dir, title, body):
        captured["body"] = body
        return mock.Mock(returncode=0, stdout='{"execution_id": "e-1", "status": "completed"}\n')

    with mock.patch.object(worker, "ensure_repo", return_value=tmp_path), mock.patch.object(
        worker, "run_bugfixer", side_effect=spy_runner
    ), mock.patch.object(worker.poller, "mark_processed"):
        worker.process_issue(cfg, "owner", "repo", make_issue())
    assert captured["body"] == ""


def test_parse_runner_output_picks_json_line_from_noise():
    raw = 'some log line\nnot json\n{"execution_id": "e-1", "status": "completed"}\n'
    out = worker.parse_runner_output(raw)
    assert out == {"execution_id": "e-1", "status": "completed"}


def test_parse_runner_output_none_when_no_json():
    assert worker.parse_runner_output("nothing useful here") is None
    assert worker.parse_runner_output("") is None


def test_runner_env_adds_pythonpath():
    cfg = worker.WorkerConfig(
        token="t",
        bugfixer_cmd=["python", "-m", "bugfixer.run"],
        bugfixer_pythonpath=r"C:\agents\bugfixer",
    )
    env = worker.runner_env(cfg)
    assert r"C:\agents\bugfixer" in env["PYTHONPATH"].split(";")
