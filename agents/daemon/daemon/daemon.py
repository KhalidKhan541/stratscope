"""24/7 daemon loop that feeds GitHub issues to the bugfixer agent.

Run with ``python -m daemon.daemon`` from ``agents/daemon``.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shlex
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import poller, worker
from .poller import DEFAULT_PROCESSED_LABEL

LOGGER_NAME = "stratscope.daemon"
PACKAGE_DIR = Path(__file__).resolve().parent  # agents/daemon/daemon
DAEMON_DIR = PACKAGE_DIR.parent  # agents/daemon
MONOREPO_ROOT = PACKAGE_DIR.parents[2]  # <monorepo root>
DEFAULT_WORK_ROOT = DAEMON_DIR / "work"
BUGFIXER_DIR = MONOREPO_ROOT / "agents" / "bugfixer"


@dataclass
class DaemonConfig:
    token: str
    repos: list[dict[str, str]]
    poll_interval_sec: int = 300
    dry_run: bool = False
    processed_label: str = DEFAULT_PROCESSED_LABEL
    comment: bool = False
    work_root: Path = DEFAULT_WORK_ROOT
    clone_url_base: str = "https://github.com"
    timeout_sec: int = 1800
    bugfixer_cmd: list[str] = field(default_factory=lambda: ["python", "-m", "bugfixer.run"])
    bugfixer_pythonpath: str | None = None


class JsonFormatter(logging.Formatter):
    """One JSON object per log line, with the ``loop: daemon`` envelope."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "loop": "daemon",
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "msg": record.getMessage(),
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(fields)
        return json.dumps(payload, default=str)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.propagate = False


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def split_command(cmd: str) -> list[str]:
    """Split a command string on whitespace, honoring quotes.

    ``shlex`` in posix mode eats backslashes in Windows paths, so on Windows
    we split with ``posix=False`` and strip surrounding matching quotes.
    """
    if sys.platform == "win32":
        tokens = shlex.split(cmd, posix=False)
        return [
            t[1:-1] if len(t) >= 2 and t[0] == t[-1] and t[0] in "\"'" else t
            for t in tokens
        ]
    return shlex.split(cmd)


def resolve_bugfixer(cmd_override: str | None = None, bugfixer_dir: Path = BUGFIXER_DIR):
    """Resolve the bugfixer command. Returns ``(cmd_list, pythonpath)``.

    Precedence: ``--runner`` CLI flag, then ``BUGFIXER_CMD`` env var, then the
    auto-resolved default: ``agents/bugfixer/.venv/Scripts/python -m bugfixer.run``
    on Windows (``.venv/bin/python`` on POSIX) if the venv exists, else plain
    ``python -m bugfixer.run``. ``PYTHONPATH`` is only auto-injected for the
    auto-resolved default so the ``bugfixer`` package is importable from the
    repo working directory.
    """
    if cmd_override:
        return split_command(cmd_override), None
    env_cmd = os.environ.get("BUGFIXER_CMD")
    if env_cmd:
        return split_command(env_cmd), None
    pythonpath = str(bugfixer_dir) if (bugfixer_dir / "bugfixer").is_dir() else None
    if sys.platform == "win32":
        venv_python = bugfixer_dir / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = bugfixer_dir / ".venv" / "bin" / "python"
    if venv_python.exists():
        return [str(venv_python), "-m", "bugfixer.run"], pythonpath
    return ["python", "-m", "bugfixer.run"], pythonpath


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="daemon.daemon",
        description="24/7 loop that feeds GitHub issues to the StratScope bugfixer agent.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="run a single pass over all repos and exit (used by CI)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="override POLL_INTERVAL_SEC",
    )
    parser.add_argument(
        "--runner",
        default=None,
        help="override BUGFIXER_CMD (single string, split on whitespace)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="override DRY_RUN: read issues but never label or comment",
    )
    return parser


def config_from_env(args: argparse.Namespace) -> DaemonConfig:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN environment variable is required")
    repos_raw = os.environ.get("REPOS_JSON")
    if not repos_raw:
        raise RuntimeError("REPOS_JSON environment variable is required")
    try:
        repos = json.loads(repos_raw)
    except ValueError as exc:
        raise RuntimeError(f"REPOS_JSON is not valid JSON: {exc}") from None
    if not isinstance(repos, list):
        raise RuntimeError('REPOS_JSON must be a JSON list of {"owner": ..., "repo": ...} objects')
    for entry in repos:
        if not isinstance(entry, dict) or not entry.get("owner") or not entry.get("repo"):
            raise RuntimeError(
                'each REPOS_JSON entry needs non-empty "owner" and "repo" keys'
            )
    if args.interval is not None:
        poll_interval = args.interval
    else:
        poll_interval = int(os.environ.get("POLL_INTERVAL_SEC", "300"))
    bugfixer_cmd, pythonpath = resolve_bugfixer(args.runner)
    return DaemonConfig(
        token=token,
        repos=repos,
        poll_interval_sec=poll_interval,
        dry_run=args.dry_run or env_flag("DRY_RUN"),
        processed_label=os.environ.get("PROCESSED_LABEL", DEFAULT_PROCESSED_LABEL),
        comment=env_flag("COMMENT_ON_ISSUE"),
        bugfixer_cmd=bugfixer_cmd,
        bugfixer_pythonpath=pythonpath,
    )


def run_pass(cfg: DaemonConfig, logger: logging.Logger | None = None) -> list[dict]:
    """One pass over every configured repo. Returns per-issue result dicts."""
    if logger is None:
        logger = logging.getLogger(LOGGER_NAME)
    results: list[dict] = []
    for repo_cfg in cfg.repos:
        owner, repo = repo_cfg["owner"], repo_cfg["repo"]
        try:
            issue = poller.select_next_issue(
                owner, repo, cfg.token, processed_label=cfg.processed_label
            )
        except Exception as exc:
            logger.warning(
                "select_next_issue failed",
                extra={
                    "fields": {
                        "owner": owner,
                        "repo": repo,
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                },
            )
            continue
        if issue is None:
            logger.info(
                "no unprocessed issue",
                extra={"fields": {"owner": owner, "repo": repo}},
            )
            continue
        wcfg = worker.WorkerConfig(
            token=cfg.token,
            bugfixer_cmd=cfg.bugfixer_cmd,
            dry_run=cfg.dry_run,
            comment=cfg.comment,
            processed_label=cfg.processed_label,
            work_root=cfg.work_root,
            clone_url_base=cfg.clone_url_base,
            timeout_sec=cfg.timeout_sec,
            bugfixer_pythonpath=cfg.bugfixer_pythonpath,
        )
        result = worker.process_issue(wcfg, owner, repo, issue)
        fields = {
            key: result[key]
            for key in (
                "owner",
                "repo",
                "issue",
                "status",
                "execution_id",
                "tests_passed",
                "changes",
                "marked_processed",
            )
            if key in result
        }
        logger.info("issue processed", extra={"fields": fields})
        results.append(result)
    return results


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    setup_logging()
    logger = logging.getLogger(LOGGER_NAME)
    try:
        cfg = config_from_env(args)
    except RuntimeError as exc:
        logger.error(str(exc))
        return 2
    logger.info(
        "daemon starting",
        extra={
            "fields": {
                "dry_run": cfg.dry_run,
                "repo_count": len(cfg.repos),
                "interval_sec": cfg.poll_interval_sec,
                "bugfixer_cmd": cfg.bugfixer_cmd,
            }
        },
    )
    while True:
        try:
            run_pass(cfg, logger)
        except KeyboardInterrupt:
            logger.info("daemon interrupted")
            break
        if args.once:
            break
        try:
            time.sleep(cfg.poll_interval_sec)
        except KeyboardInterrupt:
            break
    logger.info("daemon stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
