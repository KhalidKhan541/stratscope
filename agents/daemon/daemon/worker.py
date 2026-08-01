"""Worker: checkout a repo and hand one issue to the bugfixer CLI."""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import github_api, poller


@dataclass
class WorkerConfig:
    token: str
    bugfixer_cmd: list[str]
    dry_run: bool = False
    comment: bool = False
    processed_label: str = "stratscope-processed"
    work_root: Path = Path("work")
    clone_url_base: str = "https://github.com"
    timeout_sec: int = 1800
    bugfixer_pythonpath: str | None = None


def _run_git(args: list[str], timeout_sec: int) -> subprocess.CompletedProcess:
    return subprocess.run(
        args, check=True, capture_output=True, text=True, timeout=timeout_sec
    )


def _clone_repo(url: str, target: Path, timeout_sec: int) -> None:
    _run_git(["git", "clone", "--depth", "1", "--quiet", url, str(target)], timeout_sec)


def _update_repo(target: Path, timeout_sec: int) -> None:
    _run_git(["git", "fetch", "--quiet", "origin"], timeout_sec)
    _run_git(["git", "reset", "--hard", "--quiet", "origin/HEAD"], timeout_sec)


def ensure_repo(cfg: WorkerConfig, owner: str, repo: str) -> Path:
    """Shallow-clone the repo into ``work/<owner>_<repo>`` or fast-forward it."""
    work_root = Path(cfg.work_root)
    work_root.mkdir(parents=True, exist_ok=True)
    target = work_root / f"{owner}_{repo}"
    if not (target / ".git").exists():
        _clone_repo(f"{cfg.clone_url_base}/{owner}/{repo}.git", target, cfg.timeout_sec)
    else:
        _update_repo(target, cfg.timeout_sec)
    return target


def runner_env(cfg: WorkerConfig) -> dict:
    """Environment for the bugfixer subprocess: caller env plus PYTHONPATH."""
    env = os.environ.copy()
    if cfg.bugfixer_pythonpath:
        existing = env.get("PYTHONPATH")
        env["PYTHONPATH"] = (
            cfg.bugfixer_pythonpath
            if not existing
            else cfg.bugfixer_pythonpath + os.pathsep + existing
        )
    return env


def run_bugfixer(
    cfg: WorkerConfig, repo_dir: Path, title: str, body: str
) -> subprocess.CompletedProcess:
    cmd = cfg.bugfixer_cmd + [
        "--workdir",
        str(repo_dir),
        "--title",
        title,
        "--body",
        body,
    ]
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(repo_dir),
        env=runner_env(cfg),
        timeout=cfg.timeout_sec,
    )


def parse_runner_output(raw: str) -> dict | None:
    """Find the first stdout line that parses as a bugfixer result JSON object."""
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        if isinstance(obj, dict) and "execution_id" in obj:
            return obj
    return None


def _comment_body(result: dict) -> str:
    return "\n".join(
        [
            f"StratScope daemon finished processing issue #{result.get('issue')}.",
            f"- status: {result.get('status')}",
            f"- execution_id: {result.get('execution_id')}",
            f"- tests_passed: {result.get('tests_passed')}",
            f"- changes: {result.get('changes')}",
        ]
    )


def process_issue(cfg: WorkerConfig, owner: str, repo: str, issue: dict) -> dict:
    """Run the bugfixer on one issue. Never raises; returns a result dict."""
    number = issue.get("number")
    result: dict[str, Any] = {
        "owner": owner,
        "repo": repo,
        "issue": number,
        "status": "unknown",
        "execution_id": None,
        "tests_passed": None,
        "changes": None,
        "marked_processed": False,
    }

    try:
        repo_dir = ensure_repo(cfg, owner, repo)
    except Exception as exc:
        result["status"] = "checkout_error"
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result

    try:
        proc = run_bugfixer(
            cfg,
            repo_dir,
            str(issue.get("title") or ""),
            str(issue.get("body") or ""),
        )
    except Exception as exc:
        result["status"] = "runner_error"
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result

    outcome = parse_runner_output(proc.stdout or "")
    if outcome is None:
        result["status"] = "failed"
        stderr_tail = (proc.stderr or "").strip().splitlines()[-5:]
        result["error"] = (
            f"bugfixer printed no parseable JSON line (exit {proc.returncode})"
            + (f"; stderr tail: {' | '.join(stderr_tail)}" if stderr_tail else "")
        )
    else:
        result["execution_id"] = outcome.get("execution_id")
        result["tests_passed"] = outcome.get("tests_passed")
        result["changes"] = outcome.get("changes")
        declared = outcome.get("status") or "failed"
        result["status"] = "failed" if proc.returncode != 0 else declared

    # Always mark processed once the bugfixer ran, even on failure: the failure
    # is recorded by telemetry, and re-running the same bug forever is waste.
    if not cfg.dry_run:
        try:
            poller.mark_processed(owner, repo, number, cfg.token, label=cfg.processed_label)
            result["marked_processed"] = True
        except Exception as exc:
            result["mark_error"] = f"{type(exc).__name__}: {exc}"

    if cfg.comment and not cfg.dry_run:
        try:
            github_api.comment_on_issue(owner, repo, number, _comment_body(result), token=cfg.token)
            result["commented"] = True
        except Exception as exc:
            result["comment_error"] = f"{type(exc).__name__}: {exc}"

    return result
