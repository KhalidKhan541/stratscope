"""Tests for daemon.daemon (loop, config, args, DRY_RUN). No network."""

import json
import logging
import sys
from pathlib import Path
from unittest import mock

import pytest

from daemon import daemon as daemon_module
from daemon.daemon import (
    build_parser,
    config_from_env,
    main,
    resolve_bugfixer,
    run_pass,
    split_command,
)

FAKE_RUNNER = Path(__file__).resolve().parent / "fake_runner.py"


def make_issue(number=5):
    return {"number": number, "title": "bug", "labels": []}


def test_help_exits_zero_without_env(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("REPOS_JSON", raising=False)
    with pytest.raises(SystemExit) as exc_info:
        build_parser().parse_args(["--help"])
    assert exc_info.value.code == 0


def test_missing_token_raises_at_runtime_not_import_time(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("REPOS_JSON", "[]")
    with pytest.raises(RuntimeError):
        config_from_env(build_parser().parse_args(["--once"]))


def test_missing_repos_json_raises(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.delenv("REPOS_JSON", raising=False)
    with pytest.raises(RuntimeError):
        config_from_env(build_parser().parse_args(["--once"]))


def test_config_from_env_and_cli_overrides(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", json.dumps([{"owner": "o", "repo": "r"}]))
    monkeypatch.setenv("POLL_INTERVAL_SEC", "60")
    monkeypatch.setenv("DRY_RUN", "true")
    cfg = config_from_env(build_parser().parse_args(["--once", "--interval", "7"]))
    assert cfg.token == "tok"
    assert cfg.repos == [{"owner": "o", "repo": "r"}]
    assert cfg.poll_interval_sec == 7  # --interval beats POLL_INTERVAL_SEC
    assert cfg.dry_run is True


def test_config_uses_env_interval_when_no_flag(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", "[]")
    monkeypatch.setenv("POLL_INTERVAL_SEC", "42")
    cfg = config_from_env(build_parser().parse_args(["--once"]))
    assert cfg.poll_interval_sec == 42


def test_config_defaults_poll_interval(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", "[]")
    monkeypatch.delenv("POLL_INTERVAL_SEC", raising=False)
    cfg = config_from_env(build_parser().parse_args(["--once"]))
    assert cfg.poll_interval_sec == 300


def test_config_rejects_bad_repos_json(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", "not json")
    with pytest.raises(RuntimeError):
        config_from_env(build_parser().parse_args(["--once"]))
    monkeypatch.setenv("REPOS_JSON", '{"a": 1}')
    with pytest.raises(RuntimeError):
        config_from_env(build_parser().parse_args(["--once"]))
    monkeypatch.setenv("REPOS_JSON", '[{"owner": "o"}]')
    with pytest.raises(RuntimeError):
        config_from_env(build_parser().parse_args(["--once"]))


def test_split_command_handles_quotes_and_windows_paths():
    assert split_command("python -m bugfixer.run") == ["python", "-m", "bugfixer.run"]
    assert split_command('"C:\\Program Files\\python.exe" -m bugfixer.run') == [
        "C:\\Program Files\\python.exe",
        "-m",
        "bugfixer.run",
    ]


def test_resolve_bugfixer_uses_env(monkeypatch):
    monkeypatch.setenv("BUGFIXER_CMD", "python -m bugfixer.run")
    cmd, pythonpath = resolve_bugfixer()
    assert cmd == ["python", "-m", "bugfixer.run"]
    assert pythonpath is None  # explicit commands get no auto PYTHONPATH


def test_resolve_bugfixer_defaults_without_env(tmp_path, monkeypatch):
    monkeypatch.delenv("BUGFIXER_CMD", raising=False)
    cmd, _ = resolve_bugfixer(bugfixer_dir=tmp_path)
    assert cmd == ["python", "-m", "bugfixer.run"]


def test_resolve_bugfixer_prefers_venv_python(tmp_path, monkeypatch):
    monkeypatch.delenv("BUGFIXER_CMD", raising=False)
    if sys.platform == "win32":
        venv_python = tmp_path / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = tmp_path / ".venv" / "bin" / "python"
    venv_python.parent.mkdir(parents=True)
    venv_python.write_text("")
    (tmp_path / "bugfixer").mkdir()
    cmd, pythonpath = resolve_bugfixer(bugfixer_dir=tmp_path)
    assert cmd == [str(venv_python), "-m", "bugfixer.run"]
    assert pythonpath == str(tmp_path)


def test_resolve_bugfixer_runner_override_wins(monkeypatch):
    monkeypatch.setenv("BUGFIXER_CMD", "ignored")
    cmd, pythonpath = resolve_bugfixer(cmd_override="some cmd --flag")
    assert cmd == ["some", "cmd", "--flag"]
    assert pythonpath is None


def test_dry_run_loop_never_labels_or_comments(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", json.dumps([{"owner": "o", "repo": "r"}]))
    monkeypatch.setenv("DRY_RUN", "true")
    args = build_parser().parse_args(
        ["--once", "--runner", " ".join([sys.executable, str(FAKE_RUNNER)])]
    )
    cfg = config_from_env(args)
    cfg.work_root = tmp_path / "work"
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    logger = mock.Mock()
    with mock.patch.object(
        daemon_module.poller.github_api, "get_issues", return_value=[make_issue()]
    ) as get_issues, mock.patch.object(
        daemon_module.worker, "ensure_repo", return_value=repo_dir
    ), mock.patch.object(daemon_module.poller, "mark_processed") as mark_processed, mock.patch.object(
        daemon_module.worker.github_api, "comment_on_issue"
    ) as comment_on_issue:
        results = run_pass(cfg, logger)
    assert len(results) == 1
    assert results[0]["status"] == "completed"
    assert results[0]["marked_processed"] is False
    get_issues.assert_called_once_with(
        "o", "r", sort="created", direction="desc", token="tok"
    )
    mark_processed.assert_not_called()
    comment_on_issue.assert_not_called()


def test_run_pass_skips_repos_without_issues(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv(
        "REPOS_JSON", json.dumps([{"owner": "o", "repo": "r1"}, {"owner": "o", "repo": "r2"}])
    )
    cfg = config_from_env(build_parser().parse_args(["--once"]))
    cfg.work_root = tmp_path / "work"
    logger = mock.Mock()

    def fake_select(owner, repo, token, processed_label="stratscope-processed"):
        return make_issue() if repo == "r2" else None

    with mock.patch.object(
        daemon_module.poller, "select_next_issue", side_effect=fake_select
    ), mock.patch.object(
        daemon_module.worker, "process_issue", return_value={"status": "completed"}
    ) as process_issue:
        results = run_pass(cfg, logger)
    assert len(results) == 1
    process_issue.assert_called_once()


def test_run_pass_survives_select_error(tmp_path, monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", json.dumps([{"owner": "o", "repo": "r"}]))
    cfg = config_from_env(build_parser().parse_args(["--once"]))
    cfg.work_root = tmp_path / "work"
    logger = mock.Mock()
    with mock.patch.object(
        daemon_module.poller, "select_next_issue", side_effect=RuntimeError("api down")
    ):
        results = run_pass(cfg, logger)
    assert results == []
    logger.warning.assert_called_once()


def test_main_returns_2_when_token_missing(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("REPOS_JSON", "[]")
    assert main(["--once"]) == 2


def test_main_once_runs_single_pass_and_exits_zero(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "tok")
    monkeypatch.setenv("REPOS_JSON", json.dumps([{"owner": "o", "repo": "r"}]))
    monkeypatch.setenv("BUGFIXER_CMD", "python -m bugfixer.run")
    with mock.patch.object(daemon_module, "run_pass", return_value=[]) as run_pass_mock:
        code = main(["--once"])
    assert code == 0
    run_pass_mock.assert_called_once()


def test_json_formatter_envelope():
    record = logging.LogRecord(
        name="stratscope.daemon",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello",
        args=(),
        exc_info=None,
    )
    record.fields = {"owner": "o", "repo": "r"}
    formatted = daemon_module.JsonFormatter().format(record)
    payload = json.loads(formatted)
    assert payload["level"] == "info"
    assert payload["loop"] == "daemon"
    assert payload["msg"] == "hello"
    assert payload["owner"] == "o"
