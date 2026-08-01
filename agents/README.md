# StratScope Autonomous Bug-Fixing Pipeline

A fully autonomous loop: every GitHub issue in a watched repo gets fixed by an AI agent, and every fix attempt is recorded as a telemetry trace in StratScope — turning bug reports into sellable execution data.

## Components

| Component | Location | Entry point | Role |
|---|---|---|---|
| Bugfixer agent | `agents/bugfixer/` | `python -m bugfixer.run` | LangGraph agent that turns an issue into a fix (plan → code → test), driven by Groq via `GROQ_API_KEY` + `LLM_MODEL` |
| Daemon | `agents/daemon/` | `python -m daemon.daemon` | Polls GitHub issues via `GITHUB_TOKEN`, dedups, invokes the bugfixer, sends telemetry to the StratScope API |
| Workflow | `.github/workflows/agent-fix.yml` | — | CI shell: installs packages, runs the daemon on a cron, on manual dispatch, or on issue comments |

## Data flow

```
GitHub issue
  → daemon polls (every 30 min via cron, or on demand)
  → daemon clones repo, skips already-processed issues (label `stratscope-processed`)
  → bugfixer agent attempts a fix (Groq LLM)
  → daemon records execution trace via StratScope API
      (STRATSCOPE_API_KEY, STRATSCOPE_PROJECT_ID, STRATSCOPE_AGENT_ID)
  → every attempt — success or failure — becomes immutable execution telemetry
      → feeds evaluation, reflection, datasets, benchmarks (EIOS)
```

## One-time setup

1. **Pick the repo.** Create a dedicated repo for this pipeline, or use the StratScope repo itself. The workflow, daemon, and packages must live in it (the workflow runs `pip install -e sdk/python -e agents/bugfixer -e agents/daemon` from the repo root).

2. **Add secrets** — repo `Settings → Secrets and variables → Actions → Secrets`:

   | Secret | Required | Purpose |
   |---|---|---|
   | `STRATSCOPE_GITHUB_TOKEN` | Yes | GitHub token for the daemon (issues, PRs, labels, cloning) |
   | `REPOS_JSON` | Yes | Watched repos: `[{"owner":"<you>","repo":"<repo>"}]` |
   | `STRATSCOPE_API_KEY` | Yes | StratScope ingestion auth |
   | `STRATSCOPE_BASE_URL` | No | Defaults to `https://stratscope-api.khalidkhan.workers.dev` |
   | `STRATSCOPE_PROJECT_ID` | Yes | StratScope project |
   | `STRATSCOPE_AGENT_ID` | Yes | StratScope agent identity for traces |
   | `GROQ_API_KEY` | Yes | LLM provider for the bugfixer |

   **Variables:** add `LLM_MODEL` (e.g. `llama-3.3-70b-versatile`) under `Actions → Variables`.

3. **Dry run first.** Go to `Actions → Agent Fix Pipeline → Run workflow`, check `dry_run` — the daemon fetches issues but doesn't call the LLM or write anything. Verify logs look sane.

4. **Turn on the cron.** Uncheck `dry_run` for future runs. The schedule (`*/30 * * * *`, every 30 minutes) then runs automatically. For a single issue, comment `@stratscope-fix` on it — the workflow reacts on `issue_comment` and runs `--once` (which picks the newest unprocessed issue).

## Dedup

The daemon labels processed issues with `stratscope-processed` and skips issues that already carry it. Never remove the label manually unless you want the issue reprocessed.

## Troubleshooting

- **Missing `GROQ_API_KEY` / LLM failure** — the bugfixer fails, but the failure is still recorded as a failed execution trace. Telemetry is never lost; check the issue state and the StratScope trace.
- **Daemon clone failures** — wrong/missing `GITHUB_TOKEN` permissions (needs `contents: read` on the target repo) or the repo is private and not reachable by the token.
- **Invalid `REPOS_JSON`** — daemon exits immediately at startup with a JSON parse error; it must be exactly `[{"owner":"<you>","repo":"<repo>"}]` (valid JSON, no surrounding quotes).
- **Workflow not running on schedule** — cron triggers need the default branch; check that `workflow_dispatch` runs first, then look at the Actions tab for schedule runs.
