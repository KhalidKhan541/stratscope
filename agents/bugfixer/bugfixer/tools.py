"""Tool functions for the bugfixer agent.

Every tool operates inside a working directory (kept in graph state as
``workdir``) and refuses to escape it. Tools return plain strings so their
output can be fed directly back to the LLM; ``run_command`` is the exception
and returns a ``(stdout, exit_code)`` tuple for programmatic callers — use
``run_command_text`` when the result is meant for the model.
"""

from __future__ import annotations

import os
import subprocess
from typing import Tuple

__all__ = [
    "SKIP_DIRS",
    "read_file",
    "list_files",
    "write_file",
    "run_command",
    "run_command_text",
    "git_status",
    "git_commit",
]

SKIP_DIRS = {".git", ".venv", "venv", "__pycache__", ".pytest_cache", "node_modules"}


def _abspath(workdir: str, rel: str) -> str:
    root = os.path.abspath(workdir)
    if not os.path.isdir(root):
        raise FileNotFoundError(f"working directory does not exist: {root}")
    target = os.path.abspath(os.path.join(root, rel))
    if os.path.commonpath([root, target]) != root:
        raise ValueError(f"path escapes working directory: {rel}")
    return target


def read_file(path: str, workdir: str) -> str:
    """Return the contents of a file relative to ``workdir``."""
    target = _abspath(workdir, path)
    try:
        with open(target, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError as exc:
        return f"ERROR: cannot read {path}: {exc}"


def list_files(workdir: str) -> str:
    """Return a newline-separated, sorted listing of files under ``workdir``."""
    found: list[str] = []
    for root, dirs, files in os.walk(workdir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            found.append(os.path.relpath(os.path.join(root, name), workdir))
    found.sort()
    return "\n".join(found) if found else "(empty directory)"


def write_file(path: str, content: str, workdir: str) -> str:
    """Write ``content`` to ``path`` (relative to ``workdir``), creating parents."""
    target = _abspath(workdir, path)
    try:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(content)
    except OSError as exc:
        return f"ERROR: cannot write {path}: {exc}"
    return f"wrote {path} ({len(content)} bytes)"


def run_command(cmd: str, workdir: str, timeout: int = 120) -> Tuple[str, int]:
    """Run ``cmd`` in ``workdir``; return ``(stdout+stderr, exit_code)``."""
    try:
        proc = subprocess.run(
            cmd,
            shell=True,  # Windows has no posix shell
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return f"ERROR: command timed out after {timeout}s", 124
    except OSError as exc:
        return f"ERROR: failed to run command: {exc}", 127
    out = proc.stdout
    if proc.stderr:
        out = out + ("\n" if out else "") + proc.stderr
    return out, proc.returncode


def run_command_text(cmd: str, workdir: str, timeout: int = 120) -> str:
    """Run ``cmd`` and format the result as a plain string for the LLM."""
    out, code = run_command(cmd, workdir, timeout)
    return f"exit_code={code}\n{out}"


def git_status(workdir: str) -> str:
    """Return ``git status --short`` output (or "(clean)")."""
    out, code = run_command("git status --short", workdir)
    if code != 0:
        return f"ERROR: not a git repository or git unavailable:\n{out}"
    return out.strip() or "(clean)"


def git_commit(message: str, workdir: str) -> str:
    """Stage everything and commit with ``message`` (inline git identity)."""
    add_out, add_code = run_command("git add -A", workdir)
    if add_code != 0:
        return f"ERROR: git add failed:\n{add_out}"
    safe_message = str(message).replace('"', "'")
    cmd = (
        'git -c user.name="StratScope Bugfixer" '
        '-c user.email="bugfixer@stratscope.local" '
        f'commit -m "{safe_message}"'
    )
    out, code = run_command(cmd, workdir)
    if code != 0:
        if "nothing to commit" in out.lower():
            return "nothing to commit (no changes staged)"
        return f"ERROR: git commit failed:\n{out}"
    return out.strip()
