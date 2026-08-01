"""StratScope Python SDK — official client for the StratScope Execution Intelligence Platform.

Track AI executions and emit execution events with minimal overhead.

Usage:
    import stratscope

    execution = stratscope.start(
        api_key="sk-...",
        project_id="proj_123",
        agent_id="agent_456",
        model="llama-3.3-70b-versatile",
        provider="groq",
    )
    execution.event("step_started", {"step": "extract"})
    execution.finish(status="completed", latency_ms=1200, tokens_in=1200, tokens_out=900)
"""

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Literal, Optional, Tuple

__version__ = "0.1.0"

_DEFAULT_BASE_URL = "https://stratscope-api.khalidkhan.workers.dev"
_SDK_HEADER = f"python-{__version__}"
_BATCH_SIZE = 20
_MAX_BATCH = 500
_TIMEOUT_SECONDS = 10
_RETRY_DELAY_SECONDS = 0.5

logger = logging.getLogger("stratscope")

__all__ = ["start", "StratScopeError", "StratScopeExecution", "__version__"]


class StratScopeError(Exception):
    """Raised when the StratScope API rejects a request."""


def _extract_error_message(err: urllib.error.HTTPError) -> str:
    try:
        body = err.read()
    except Exception:
        body = b""
    text = body.decode("utf-8", "replace").strip() if body else ""
    if text:
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                for key in ("error", "message"):
                    value = data.get(key)
                    if isinstance(value, str) and value:
                        return value
        except ValueError:
            pass
        return text
    return err.reason


def _request(
    method: str,
    url: str,
    payload: Dict[str, Any],
    api_key: str,
) -> Tuple[int, Optional[Dict[str, Any]]]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": f"stratscope-python/{__version__}",
        "X-StratScope-SDK": _SDK_HEADER,
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            body = response.read()
            if not body:
                return response.status, None
            try:
                return response.status, json.loads(body)
            except ValueError:
                return response.status, None
    except urllib.error.HTTPError as err:
        raise StratScopeError(
            f"StratScope API error {err.code}: {_extract_error_message(err)}"
        ) from err


def _send_best_effort(method: str, url: str, payload: Dict[str, Any], api_key: str) -> None:
    try:
        _request(method, url, payload, api_key)
        return
    except (urllib.error.URLError, OSError, StratScopeError):
        pass
    time.sleep(_RETRY_DELAY_SECONDS)
    try:
        _request(method, url, payload, api_key)
        return
    except (urllib.error.URLError, OSError, StratScopeError) as err:
        logger.warning(
            "StratScope request to %s failed after retry: %s; dropping payload", url, err
        )


class StratScopeExecution:
    """A tracked execution on the StratScope platform."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        execution_id: Optional[str],
        trace_id: Optional[str],
        project_id: str,
        agent_id: str,
        model: Optional[str],
        provider: Optional[str],
    ) -> None:
        self.id = execution_id
        self.trace_id = trace_id
        self.project_id = project_id
        self.agent_id = agent_id
        self.model = model
        self.provider = provider
        self._api_key = api_key
        self._base_url = base_url
        self._buffer: List[Dict[str, Any]] = []

    def event(self, event_type: str, payload: dict, metadata: Optional[dict] = None) -> None:
        event: Dict[str, Any] = {
            "event_type": event_type,
            "execution_id": self.id,
            "payload": payload,
        }
        if metadata is not None:
            event["metadata"] = metadata
        self._buffer.append(event)
        if len(self._buffer) >= _BATCH_SIZE:
            self._flush()

    def _flush(self) -> None:
        if not self._buffer:
            return
        pending, self._buffer = self._buffer, []
        url = self._base_url.rstrip("/") + "/v1/ingest/events"
        for offset in range(0, len(pending), _MAX_BATCH):
            _send_best_effort(
                "POST", url, {"batch": pending[offset : offset + _MAX_BATCH]}, self._api_key
            )

    def finish(
        self,
        *,
        status: Literal["completed", "failed"],
        latency_ms: Optional[int] = None,
        cost_usd: Optional[float] = None,
        tokens_in: Optional[int] = None,
        tokens_out: Optional[int] = None,
        error: Optional[str] = None,
    ) -> None:
        if self.id is None:
            return
        self._flush()
        payload: Dict[str, Any] = {"status": status}
        for key, value in (
            ("latency_ms", latency_ms),
            ("cost_usd", cost_usd),
            ("tokens_in", tokens_in),
            ("tokens_out", tokens_out),
            ("error", error),
        ):
            if value is not None:
                payload[key] = value
        _send_best_effort(
            "PATCH",
            self._base_url.rstrip("/") + "/v1/ingest/executions/" + self.id,
            payload,
            self._api_key,
        )


def start(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    project_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    model: Optional[str] = None,
    provider: Optional[str] = None,
    trace_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> StratScopeExecution:
    api_key = api_key or os.environ.get("STRATSCOPE_API_KEY")
    if not api_key:
        raise ValueError(
            "start() requires api_key or the STRATSCOPE_API_KEY environment variable"
        )
    if base_url is None:
        base_url = os.environ.get("STRATSCOPE_BASE_URL", _DEFAULT_BASE_URL)
    if project_id is None:
        project_id = os.environ.get("STRATSCOPE_PROJECT_ID")
    if agent_id is None:
        agent_id = os.environ.get("STRATSCOPE_AGENT_ID")
    if project_id is None or agent_id is None:
        raise ValueError(
            "start() requires project_id and agent_id (or the "
            "STRATSCOPE_PROJECT_ID / STRATSCOPE_AGENT_ID environment variables)"
        )
    url = base_url.rstrip("/") + "/v1/ingest/executions"
    payload: Dict[str, Any] = {
        "project_id": project_id,
        "agent_id": agent_id,
        "sdk_version": __version__,
    }
    for key, value in (
        ("model", model),
        ("provider", provider),
        ("trace_id", trace_id),
        ("metadata", metadata),
    ):
        if value is not None:
            payload[key] = value
    try:
        _, data = _request("POST", url, payload, api_key)
    except (urllib.error.URLError, OSError) as err:
        time.sleep(_RETRY_DELAY_SECONDS)
        try:
            _, data = _request("POST", url, payload, api_key)
        except (urllib.error.URLError, OSError) as err:
            logger.warning(
                "StratScope execution start failed after retry: %s; dropping payload", err
            )
            return StratScopeExecution(
                api_key, base_url, None, trace_id, project_id, agent_id, model, provider
            )
    result = data.get("data") if isinstance(data, dict) else None
    if not isinstance(result, dict):
        result = {}
    execution_id = result.get("id")
    if not isinstance(execution_id, str):
        execution_id = None
    resolved_trace_id = result.get("trace_id")
    if not isinstance(resolved_trace_id, str):
        resolved_trace_id = trace_id
    return StratScopeExecution(
        api_key,
        base_url,
        execution_id,
        resolved_trace_id,
        project_id,
        agent_id,
        model,
        provider,
    )
