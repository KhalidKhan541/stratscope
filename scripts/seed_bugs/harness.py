"""End-to-end synthetic bug-fixing loop for StratScope.

Each iteration: seed a synthetic bug in a fresh scratch repo, run the
bugfixer agent CLI against it, record the outcome, and verify whether the
fix actually made the tests green. Results accumulate in work/results.jsonl
so execution traces can be sold / benchmarked without needing real GitHub
issues.

Usage:
    python harness.py --iterations 10 --interval 30
    python harness.py --iterations 3 --runner "python -m bugfixer.run"
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUNNER = [sys.executable, "-m", "bugfixer.run"]


def run_seed(workdir: Path, seed: int) -> dict:
    """Invoke seed.py and return its JSON result dict."""
    proc = subprocess.run(
        [sys.executable, str(Path(__file__).resolve().parent / "seed.py"), "--workdir", str(workdir), "--seed", str(seed)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"seed.py failed (exit {proc.returncode}): {proc.stderr[-2000:]}")
    return json.loads(proc.stdout.strip().splitlines()[-1])


def run_bugfixer(workdir: Path, title: str, body: str, runner: list[str]) -> dict:
    """Run the bugfixer agent CLI; return its JSON summary line."""
    env = dict(os.environ)
    bugfixer_pkg = REPO_ROOT / "agents" / "bugfixer"
    if bugfixer_pkg.exists() and runner == DEFAULT_RUNNER:
        env["PYTHONPATH"] = str(bugfixer_pkg) + os.pathsep + env.get("PYTHONPATH", "")
    cmd = [*runner, "--workdir", str(workdir), "--title", title, "--body", body]
    proc = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=1800,
    )
    lines = proc.stdout.strip().splitlines()
    json_line = next((ln for ln in reversed(lines) if ln.lstrip().startswith("{")), None)
    if json_line is None:
        return {
            "status": "failed",
            "tests_passed": False,
            "changes": 0,
            "execution_id": None,
            "runner_exit": proc.returncode,
            "runner_stderr_tail": proc.stderr[-500:],
        }
    result = json.loads(json_line)
    result["runner_exit"] = proc.returncode
    return result


def count_failing_tests(workdir: Path) -> int:
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider"],
        cwd=str(workdir),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    output = proc.stdout + proc.stderr
    failures = re.search(r"(\d+) failed", output)
    errors = re.search(r"(\d+) error", output)
    return (int(failures.group(1)) if failures else 0) + (int(errors.group(1)) if errors else 0)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Synthetic bug-fixing loop (seed -> agent -> verify -> record).")
    parser.add_argument("--iterations", type=int, default=1)
    parser.add_argument("--interval", type=int, default=0, help="seconds to sleep between iterations")
    parser.add_argument("--seed", type=int, default=None, help="base seed (iteration i uses base+i)")
    parser.add_argument("--keep-work", action="store_true", help="keep scratch repos under work/run<i>")
    parser.add_argument("--runner", default=None, help="override bugfixer command, e.g. 'python -m bugfixer.run'")
    args = parser.parse_args(argv)

    base_seed = args.seed if args.seed is not None else random.SystemRandom().randint(0, 2**31)
    work_root = REPO_ROOT / "scripts" / "seed_bugs" / "work"
    work_root.mkdir(parents=True, exist_ok=True)
    results_path = work_root / "results.jsonl"
    telemetry_enabled = bool(os.environ.get("STRATSCOPE_API_KEY"))

    counts = {"verified_fix": 0, "fix_failed": 0, "false_negative": 0}

    for i in range(1, args.iterations + 1):
        iteration_seed = base_seed + i
        workdir = work_root / f"run{i}"
        if workdir.exists():
            import shutil

            shutil.rmtree(workdir)
        try:
            seeded = run_seed(workdir, iteration_seed)
            runner_cmd = (
                shlex.split(args.runner, posix=False) if args.runner else DEFAULT_RUNNER
            )
            agent = run_bugfixer(
                workdir,
                seeded["title"],
                seeded["body"],
                runner_cmd,
            )
            failing_after = count_failing_tests(workdir)
            if failing_after == 0 and agent.get("status") == "completed":
                verdict = "verified_fix"
            elif failing_after == 0:
                verdict = "false_negative"
            else:
                verdict = "fix_failed"
            counts[verdict] += 1

            record = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "iteration": i,
                "bug": seeded["bug"],
                "title": seeded["title"],
                "status": agent.get("status"),
                "tests_passed": agent.get("tests_passed"),
                "changes": agent.get("changes"),
                "execution_id": agent.get("execution_id"),
                "runner_exit": agent.get("runner_exit"),
                "verdict": verdict,
                "failing_tests_after": failing_after,
                "telemetry_enabled": telemetry_enabled,
                "seed": iteration_seed,
            }
            with results_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record) + "\n")

            print(
                json.dumps(
                    {
                        "iteration": i,
                        "bug": seeded["bug"],
                        "verdict": verdict,
                        "status": agent.get("status"),
                        "changes": agent.get("changes"),
                        "execution_id": agent.get("execution_id"),
                    }
                )
            )
        except Exception as exc:  # loop must never die; record the failure
            record = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "iteration": i,
                "bug": None,
                "title": None,
                "status": "error",
                "verdict": "fix_failed",
                "error": str(exc)[-500:],
                "telemetry_enabled": telemetry_enabled,
            }
            with results_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record) + "\n")
            counts["fix_failed"] += 1
            print(json.dumps({"iteration": i, "verdict": "error", "error": str(exc)[-200:]}))

        if i < args.iterations and args.interval > 0:
            time.sleep(args.interval)

    if not args.keep_work:
        import shutil

        for run_dir in work_root.glob("run*"):
            shutil.rmtree(run_dir, ignore_errors=True)

    summary = {"iterations": args.iterations, **counts, "results_file": str(results_path)}
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
