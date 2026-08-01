"""Unit tests for bugfixer.tools (no LLM, no network)."""

import subprocess

import pytest

from bugfixer import tools


def test_write_file_and_read_file_roundtrip(tmp_path):
    wd = str(tmp_path)
    result = tools.write_file("src/a.py", "print(1)\n", wd)
    assert "wrote" in result and "src/a.py" in result
    assert tools.read_file("src/a.py", wd) == "print(1)\n"


def test_read_file_missing_returns_error_string(tmp_path):
    result = tools.read_file("nope.txt", str(tmp_path))
    assert result.startswith("ERROR")


def test_list_files_sorted_and_skips_vcs(tmp_path):
    wd = str(tmp_path)
    tools.write_file("b.py", "", wd)
    tools.write_file("a.py", "", wd)
    (tmp_path / ".git").mkdir()
    listing = tools.list_files(wd)
    assert listing.splitlines() == ["a.py", "b.py"]
    assert ".git" not in listing


def test_list_files_empty_directory(tmp_path):
    assert tools.list_files(str(tmp_path)) == "(empty directory)"


def test_path_escape_is_rejected(tmp_path):
    wd = str(tmp_path)
    with pytest.raises(ValueError):
        tools.read_file("../escape.txt", wd)
    with pytest.raises(ValueError):
        tools.write_file("..\\escape.txt", "x", wd)


def test_run_command_returns_stdout_and_exit_code(tmp_path):
    out, code = tools.run_command('python -c "print(\'hello\')"', str(tmp_path))
    assert code == 0
    assert "hello" in out


def test_run_command_reports_nonzero_exit_code(tmp_path):
    out, code = tools.run_command('python -c "import sys; sys.exit(3)"', str(tmp_path))
    assert code == 3


def test_git_status_and_git_commit(tmp_path):
    wd = str(tmp_path)
    subprocess.run("git init", cwd=wd, shell=True, check=True, capture_output=True, text=True)
    tools.write_file("fix.py", "x = 1\n", wd)
    status = tools.git_status(wd)
    assert "fix.py" in status
    result = tools.git_commit("initial fix", wd)
    assert not result.startswith("ERROR")
    assert "initial fix" in result
    assert tools.git_status(wd) == "(clean)"
    log, code = tools.run_command("git log -1 --oneline", wd)
    assert code == 0
    assert "initial fix" in log


def test_git_status_outside_repo_returns_error(tmp_path):
    result = tools.git_status(str(tmp_path))
    assert result.startswith("ERROR")


def test_git_commit_without_changes_is_handled(tmp_path):
    wd = str(tmp_path)
    subprocess.run("git init", cwd=wd, shell=True, check=True, capture_output=True, text=True)
    result = tools.git_commit("nothing here", wd)
    assert "nothing to commit" in result
