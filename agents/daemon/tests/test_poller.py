"""Tests for daemon.poller. All GitHub API calls are mocked; no network."""

from unittest import mock

from daemon import poller
from daemon.poller import DEFAULT_PROCESSED_LABEL


def make_issue(number, labels=(), is_pr=False):
    issue = {
        "number": number,
        "title": f"issue {number}",
        "labels": [{"name": name} for name in labels],
    }
    if is_pr:
        issue["pull_request"] = {"url": f"https://api.github.com/repos/o/r/pulls/{number}"}
    return issue


def test_select_next_issue_skips_processed_and_prs():
    issues = [
        make_issue(1, labels=[DEFAULT_PROCESSED_LABEL]),
        make_issue(2, is_pr=True),
        make_issue(3),
    ]
    with mock.patch.object(poller.github_api, "get_issues", return_value=issues) as get_issues:
        selected = poller.select_next_issue("owner", "repo", "token")
    assert selected == issues[2]


def test_select_next_issue_requests_newest_first():
    with mock.patch.object(poller.github_api, "get_issues", return_value=[]) as get_issues:
        assert poller.select_next_issue("owner", "repo", "token") is None
    get_issues.assert_called_once_with(
        "owner", "repo", sort="created", direction="desc", token="token"
    )


def test_select_next_issue_returns_none_when_all_processed():
    issues = [
        make_issue(1, labels=[DEFAULT_PROCESSED_LABEL]),
        make_issue(2, labels=["bug", DEFAULT_PROCESSED_LABEL]),
        make_issue(3, is_pr=True),
    ]
    with mock.patch.object(poller.github_api, "get_issues", return_value=issues):
        assert poller.select_next_issue("owner", "repo", "token") is None


def test_select_next_issue_returns_none_when_empty():
    with mock.patch.object(poller.github_api, "get_issues", return_value=[]):
        assert poller.select_next_issue("owner", "repo", "token") is None


def test_select_next_issue_honors_custom_label():
    issues = [
        make_issue(1, labels=["done"]),
        make_issue(2),
    ]
    with mock.patch.object(poller.github_api, "get_issues", return_value=issues) as get_issues:
        selected = poller.select_next_issue("owner", "repo", "token", processed_label="done")
    assert selected == issues[1]
    get_issues.assert_called_once_with(
        "owner", "repo", sort="created", direction="desc", token="token"
    )


def test_mark_processed_creates_label_when_missing():
    with mock.patch.object(
        poller.github_api, "list_labels", return_value=[{"name": "bug"}]
    ) as list_labels, mock.patch.object(poller.github_api, "create_label") as create_label, mock.patch.object(
        poller.github_api, "add_label"
    ) as add_label:
        poller.mark_processed("owner", "repo", 42, "token", label=DEFAULT_PROCESSED_LABEL)
    list_labels.assert_called_once_with("owner", "repo", token="token")
    create_label.assert_called_once_with("owner", "repo", DEFAULT_PROCESSED_LABEL, token="token")
    add_label.assert_called_once_with("owner", "repo", 42, DEFAULT_PROCESSED_LABEL, token="token")


def test_mark_processed_reuses_existing_label():
    with mock.patch.object(
        poller.github_api, "list_labels", return_value=[{"name": DEFAULT_PROCESSED_LABEL}]
    ) as list_labels, mock.patch.object(poller.github_api, "create_label") as create_label, mock.patch.object(
        poller.github_api, "add_label"
    ) as add_label:
        poller.mark_processed("owner", "repo", 42, "token", label=DEFAULT_PROCESSED_LABEL)
    list_labels.assert_called_once_with("owner", "repo", token="token")
    create_label.assert_not_called()
    add_label.assert_called_once_with("owner", "repo", 42, DEFAULT_PROCESSED_LABEL, token="token")
