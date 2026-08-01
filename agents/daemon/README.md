# StratScope Daemon

A zero-manual-work 24/7 loop that watches GitHub repos and feeds each open
issue to the [bugfixer agent](../bugfixer/README.md) (a LangGraph agent that
edits files, runs tests, and commits locally), then marks the issue as
processed so it is never picked up again.

The daemon has **no runtime dependencies** beyond the Python standard library.
The bugfixer runs as a subprocess and is located by command resolution.

## How the loop works

```
every POLL_INTERVAL_SEC:
  for each repo in REPOS_JSON:
    issue = select_next_issue(repo)          # newest open issue, unprocessed, not a PR
    if issue is None:
        continue
    ensure_repo(work/<owner>_<repo>)          # shallow clone, or fetch + reset to origin/HEAD
    run bugfixer on the issue (cwd = repo dir)
    mark_processed(issue)                     # add the processed label
    optionally comment on the issue           # COMMENT_ON_ISSUE=true
  sleep POLL_INTERVAL_SEC
```

Every processed issue is logged as a structured JSON line on stderr, e.g.:

```json
{"level":"info","loop":"daemon","ts":"2026-07-31T10:00:00","msg":"issue processed","owner":"khalidkhan","repo":"StratScope","issue":42,"status":"completed","execution_id":"ex_...","tests_passed":true,"changes":3,"marked_processed":true}
```

## Dedup strategy

- Issues are listed newest-first (`sort=created&direction=desc`).
- Pull requests (identified by the `pull_request` key in the issue payload) are skipped.
- Once the daemon hands an issue to the bugfixer, it adds the `stratscope-processed`
  label to the issue (creating the label on the repo first if it does not exist),
  so that issue is skipped on every later pass.
- **An issue is marked processed even when the bugfixer fails.** The failure is
  recorded in the daemon telemetry, and re-trying the same bug forever would be
  wasted work. The one exception: if the repository checkout itself fails
  (`checkout_error`), the issue is **not** marked, so transient infrastructure
  problems do not silently drop issues.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | yes | — | GitHub Personal Access Token used for all API calls. Missing value is a runtime error, not an import error. |
| `REPOS_JSON` | yes | — | JSON list of repos to watch, e.g. `[{"owner":"khalidkhan","repo":"StratScope"}]` |
| `POLL_INTERVAL_SEC` | no | `300` | Seconds between passes over all repos. |
| `BUGFIXER_CMD` | no | auto | Command string for the bugfixer CLI, split on whitespace. |
| `DRY_RUN` | no | `false` | When true, the loop reads issues but never labels, creates labels, or comments. |
| `PROCESSED_LABEL` | no | `stratscope-processed` | Name of the dedup label. |
| `COMMENT_ON_ISSUE` | no | `false` | When true, post a summary comment on each processed issue. |

Truthy values for boolean flags: `1`, `true`, `yes`, `on` (case-insensitive).

## REPOS_JSON example

```json
[
  {"owner": "khalidkhan", "repo": "StratScope"},
  {"owner": "acme", "repo": "infra"}
]
```

## Bugfixer command resolution

Precedence:

1. `--runner <cmd>` CLI flag.
2. `BUGFIXER_CMD` env var.
3. Auto-resolved default: if `agents/bugfixer/.venv/Scripts/python.exe`
   (Windows) or `agents/bugfixer/.venv/bin/python` (POSIX) exists, run
   `<venv python> -m bugfixer.run`; otherwise fall back to plain
   `python -m bugfixer.run`.

For the auto-resolved default, the daemon injects `PYTHONPATH=<monorepo>/agents/bugfixer`
into the subprocess environment so the `bugfixer` package is importable even
though the command runs with `cwd` set to the repo working directory. Explicit
`--runner`/`BUGFIXER_CMD` values are used verbatim (set `PYTHONPATH` yourself
if you need it). On Windows, quoted arguments (e.g. `"C:\Program Files\python.exe"`)
are honored.

## DRY_RUN

`DRY_RUN=true` (or `--dry-run`) makes the daemon a pure observer: it selects
issues and would run the bugfixer, but never calls any mutating GitHub API —
no label creation, no label attachment, no comments. Useful for CI smoke tests
and for testing against real repos without side effects.

## CLI flags

```
python -m daemon.daemon [--once] [--interval <sec>] [--runner <cmd>] [--dry-run]
```

- `--once` — run a single pass over all repos, then exit (used by CI).
- `--interval <sec>` — override `POLL_INTERVAL_SEC`.
- `--runner <cmd>` — override `BUGFIXER_CMD`.
- `--dry-run` — override `DRY_RUN`.

## Running locally

```powershell
# from agents/daemon
python -m venv .venv
.\.venv\Scripts\python -m pip install -e . -q      # optional, for tests: add [test]
$env:GITHUB_TOKEN = "ghp_..."
$env:REPOS_JSON = '[{"owner":"khalidkhan","repo":"StratScope"}]'
python -m daemon.daemon --once --interval 1        # one pass, side effects on
python -m daemon.daemon --once --interval 1 --dry-run   # one read-only pass
python -m daemon.daemon --help                     # no env vars needed
```

While the bugfixer agent is still being built, point the daemon at a fake
runner:

```powershell
python -m daemon.daemon --once --runner "python tests\fake_runner.py"
```

## Testing

```powershell
# from agents/daemon
python -m venv .venv
.\.venv\Scripts\python -m pip install pytest -q
.\.venv\Scripts\python -m pytest tests -q
```

All tests are offline: the GitHub API client is mocked, the fake bugfixer
runner (`tests/fake_runner.py`) prints the contract JSON line, and git
operations are stubbed.
