"""Thin GitHub REST client built on stdlib ``urllib.request`` only."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

API_BASE = "https://api.github.com"
DEFAULT_TIMEOUT_SEC = 30


class GitHubAPIError(Exception):
    """Raised for any non-2xx GitHub API response (or transport failure)."""

    def __init__(self, status: int, body: str, endpoint: str = "") -> None:
        self.status = status
        self.body = body
        self.endpoint = endpoint
        super().__init__(f"GitHub API error {status} on {endpoint}: {body}")


def _resolve_token(token: str | None) -> str:
    if token:
        return token
    env_token = os.environ.get("GITHUB_TOKEN")
    if env_token:
        return env_token
    raise GitHubAPIError(0, "no token supplied and GITHUB_TOKEN is not set", endpoint="(auth)")


def _request(method: str, url: str, *, token: str | None = None, body: object = None):
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {_resolve_token(token)}",
        "User-Agent": "stratscope-daemon",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT_SEC) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        raise GitHubAPIError(exc.code, exc.read().decode("utf-8", "replace"), endpoint=url) from None
    except urllib.error.URLError as exc:
        raise GitHubAPIError(0, f"network error: {exc.reason}", endpoint=url) from None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return raw.decode("utf-8", "replace")


def _repo_url(owner: str, repo: str, *parts: str) -> str:
    path = f"/repos/{owner}/{repo}"
    for part in parts:
        path += f"/{part}"
    return API_BASE + path


def get_issues(
    owner: str,
    repo: str,
    label: str | None = None,
    state: str = "open",
    per_page: int = 30,
    sort: str = "created",
    direction: str = "desc",
    token: str | None = None,
):
    """List issues. Defaults to newest first, which the poller relies on."""
    query = {
        "state": state,
        "per_page": per_page,
        "sort": sort,
        "direction": direction,
    }
    if label:
        query["label"] = label
    url = _repo_url(owner, repo, "issues") + "?" + urllib.parse.urlencode(query)
    return _request("GET", url, token=token)


def get_issue(owner: str, repo: str, number: int, token: str | None = None):
    return _request("GET", _repo_url(owner, repo, "issues", str(number)), token=token)


def list_labels(owner: str, repo: str, token: str | None = None):
    return _request("GET", _repo_url(owner, repo, "labels"), token=token)


def create_label(
    owner: str,
    repo: str,
    name: str,
    color: str = "7057ff",
    token: str | None = None,
):
    body = {
        "name": name,
        "color": color,
        "description": "Automatically managed by the StratScope daemon",
    }
    return _request("POST", _repo_url(owner, repo, "labels"), token=token, body=body)


def add_label(owner: str, repo: str, issue_number: int, label: str, token: str | None = None):
    return _request(
        "POST",
        _repo_url(owner, repo, "issues", str(issue_number), "labels"),
        token=token,
        body=[label],
    )


def comment_on_issue(owner: str, repo: str, number: int, body: str, token: str | None = None):
    return _request(
        "POST",
        _repo_url(owner, repo, "issues", str(number), "comments"),
        token=token,
        body={"body": body},
    )
