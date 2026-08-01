"""Entry point for the StratScope bugfixer agent.

Usage::

    python -m bugfixer.run --workdir <repo> --title "<issue title>" --body "<issue body>"

Every step of the run is recorded as telemetry via the stratscope SDK.
Configuration comes exclusively from environment variables (see README).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Optional

from . import graph as graph_mod
from .llm import GroqProvider

__all__ = ["main", "build_parser"]

DEFAULT_BASE_URL = "https://stratscope-api.khalidkhan.workers.dev"
DEFAULT_MODEL = "qwen3-coder-480b"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bugfixer",
        description="StratScope bug-fixing agent (LangGraph + EIOS telemetry).",
    )
    parser.add_argument("--workdir", required=True, help="path to the repository to fix")
    parser.add_argument("--title", required=True, help="issue title")
    parser.add_argument("--body", default="", help="issue body")
    return parser


def main(argv: Optional[list] = None) -> int:
    args = build_parser().parse_args(argv)

    api_key = os.environ.get("STRATSCOPE_API_KEY")
    project_id = os.environ.get("STRATSCOPE_PROJECT_ID")
    agent_id = os.environ.get("STRATSCOPE_AGENT_ID")
    base_url = os.environ.get("STRATSCOPE_BASE_URL", DEFAULT_BASE_URL)
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)
    groq_key = os.environ.get("GROQ_API_KEY")

    missing = [
        name
        for name, value in (
            ("STRATSCOPE_API_KEY", api_key),
            ("STRATSCOPE_PROJECT_ID", project_id),
            ("STRATSCOPE_AGENT_ID", agent_id),
            ("GROQ_API_KEY", groq_key),
        )
        if not value
    ]
    if missing:
        print(f'{{"error": "missing environment variables: {", ".join(missing)}"}}', file=sys.stderr)
        return 2

    try:
        import stratscope
    except ImportError:
        print('{"error": "stratscope SDK not installed; pip install -e sdk/python"}', file=sys.stderr)
        return 2

    workdir = os.path.abspath(args.workdir)
    if not os.path.isdir(workdir):
        print(f'{{"error": "workdir does not exist: {workdir}"}}', file=sys.stderr)
        return 2

    execution = stratscope.start(
        api_key=api_key,
        base_url=base_url,
        project_id=project_id,
        agent_id=agent_id,
        model=model,
        provider="groq",
        metadata={"issue_title": args.title, "workdir": workdir},
    )
    provider = GroqProvider(model=model, api_key=groq_key)
    graph_mod.set_context(execution=execution, provider=provider)

    started = time.monotonic()
    state = graph_mod.run_graph(
        {
            "issue_title": args.title,
            "issue_body": args.body,
            "workdir": workdir,
            "messages": [],
            "changes": [],
            "tests_passed": False,
        }
    )
    latency_ms = int((time.monotonic() - started) * 1000)

    tests_passed = bool(state.get("tests_passed"))
    execution.finish(
        status="completed" if tests_passed else "failed",
        latency_ms=latency_ms,
        cost_usd=None,
        tokens_in=getattr(provider, "tokens_in", None),
        tokens_out=getattr(provider, "tokens_out", None),
        error=None,
    )

    execution_id = getattr(execution, "id", None) or getattr(execution, "execution_id", None)
    print(
        json.dumps(
            {
                "execution_id": execution_id,
                "status": "completed" if tests_passed else "failed",
                "tests_passed": tests_passed,
                "changes": len(state.get("changes", [])),
            }
        )
    )
    return 0 if tests_passed else 1


if __name__ == "__main__":
    sys.exit(main())
