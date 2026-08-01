"""Issue selection and deduplication via the processed label."""

from __future__ import annotations

from . import github_api

DEFAULT_PROCESSED_LABEL = "stratscope-processed"


def select_next_issue(
    owner: str,
    repo: str,
    token: str,
    processed_label: str = DEFAULT_PROCESSED_LABEL,
) -> dict | None:
    """Return the newest open issue that is neither a PR nor already processed.

    Issues arrive newest-first from GitHub's API (``sort=created&direction=desc``).
    Returns ``None`` when every open issue is processed, a pull request, or none exist.
    """
    issues = github_api.get_issues(
        owner,
        repo,
        sort="created",
        direction="desc",
        token=token,
    )
    for issue in issues:
        if "pull_request" in issue:
            continue
        names = {label.get("name") for label in issue.get("labels") or []}
        if processed_label in names:
            continue
        return issue
    return None


def mark_processed(
    owner: str,
    repo: str,
    number: int,
    token: str,
    label: str = DEFAULT_PROCESSED_LABEL,
) -> None:
    """Ensure the label exists, then attach it to the issue."""
    existing = {item.get("name") for item in github_api.list_labels(owner, repo, token=token)}
    if label not in existing:
        github_api.create_label(owner, repo, label, token=token)
    github_api.add_label(owner, repo, number, label, token=token)
