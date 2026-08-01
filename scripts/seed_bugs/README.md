# Synthetic Bug Seeder

Generates an endless supply of bug-fixing tasks **without needing real GitHub
issues**: seed a deterministic synthetic bug in a scratch repo, run the
bugfixer agent on it, record the outcome. The agent's execution traces are
sent to StratScope (sellable telemetry) and the loop repeats.

## Why

The 24/7 pipeline needs bugs to fix. Real issues are external supply (and
eventually harvested via the daemon); this harness is the *closed loop*:
`seed -> agent -> verify -> record -> repeat`, running unattended forever on
any machine.

## Usage

```bash
# one iteration, local dry mode (no STRATSCOPE_API_KEY -> no telemetry)
python harness.py --iterations 1

# 24/7 loop on a server: 100 iterations, 30s apart, telemetry on
set STRATSCOPE_API_KEY=sk_...
set STRATSCOPE_BASE_URL=https://stratscope-api.khalidkhan.workers.dev
set STRATSCOPE_PROJECT_ID=<project>
set STRATSCOPE_AGENT_ID=<agent>
set GROQ_API_KEY=...
set LLM_MODEL=qwen3-coder-480b
python harness.py --iterations 100 --interval 30

# override the agent command (e.g. a venv python)
python harness.py --runner "C:\path\.venv\Scripts\python -m bugfixer.run"
```

Flags: `--iterations N` (default 1), `--interval SEC`, `--seed INT`
(iteration i uses seed+i; same seed -> same bugs), `--keep-work` (keep
scratch repos), `--runner CMD`.

## How it works

1. `seed.py` writes a tiny calculator + string-utils project with a pytest
   suite, applies exactly one mutation from 7 templates (off_by_one,
   wrong_operator, swapped_args, wrong_constant, inverted_condition,
   missing_return, off_by_sign), and **verifies at least one test fails**.
   Deterministic per `--seed`. Writes `BUG.md` (issue-style title + body).
2. `harness.py` runs the bugfixer CLI (`python -m bugfixer.run
   --workdir <repo> --title <t> --body <b>`), which records the execution to
   StratScope if `STRATSCOPE_API_KEY` is set.
3. The harness re-runs pytest to grade the fix and appends one JSON line to
   `work/results.jsonl`.

## results.jsonl schema

```json
{"timestamp":"...","iteration":1,"bug":"off_by_one","title":"...",
 "status":"completed","tests_passed":true,"changes":2,
 "execution_id":"...","runner_exit":0,"verdict":"verified_fix",
 "failing_tests_after":0,"telemetry_enabled":true,"seed":1234}
```

Verdicts: `verified_fix` (tests green + agent said completed), `fix_failed`
(tests still red), `false_negative` (tests green but agent reported failure).
Failed agent runs are still recorded — failure traces are sellable data.

## Files

- `seed.py` — bug generator (bug templates, scratch project, BUG.md)
- `harness.py` — the loop (seed -> agent -> verify -> record)
- `tests/test_seed.py` — template/revert/determinism tests

`work/` is gitignored (scratch repos + results.jsonl).
