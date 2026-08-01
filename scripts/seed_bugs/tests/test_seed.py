import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from seed import TEMPLATES, build_bug_md, count_failing_tests, write_base_project

SEED_PY = Path(__file__).resolve().parent.parent / "seed.py"


def file_hashes(workdir: Path) -> dict:
    return {
        p.relative_to(workdir).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(workdir.rglob("*"))
        if p.is_file() and "__pycache__" not in p.parts and p.name != "BUG.md"
    }


def test_every_template_fails_and_reverts(tmp_path):
    write_base_project(tmp_path)
    assert count_failing_tests(tmp_path) == 0
    for tpl in TEMPLATES:
        module_path = tmp_path / tpl["module"]
        original = module_path.read_text(encoding="utf-8")
        mutated = tpl["apply"](original)
        assert mutated != original, f"template {tpl['name']} produced no change"
        module_path.write_text(mutated, encoding="utf-8")
        assert count_failing_tests(tmp_path) >= 1, f"template {tpl['name']} fails no test"
        reverted = tpl["revert"](mutated)
        assert reverted == original, f"template {tpl['name']} does not revert cleanly"
        module_path.write_text(reverted, encoding="utf-8")
        assert count_failing_tests(tmp_path) == 0, f"template {tpl['name']} revert is not green"


def test_deterministic_per_seed(tmp_path):
    out_a, out_b = tmp_path / "a", tmp_path / "b"
    proc_a = subprocess.run(
        [sys.executable, str(SEED_PY), "--workdir", str(out_a), "--seed", "1234"],
        capture_output=True,
        text=True,
        timeout=300,
    )
    proc_b = subprocess.run(
        [sys.executable, str(SEED_PY), "--workdir", str(out_b), "--seed", "1234"],
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc_a.returncode == 0 and proc_b.returncode == 0
    res_a = json.loads(proc_a.stdout.strip().splitlines()[-1])
    res_b = json.loads(proc_b.stdout.strip().splitlines()[-1])
    assert res_a["bug"] == res_b["bug"]
    assert file_hashes(out_a) == file_hashes(out_b)


def test_bug_md_written_with_title_and_body(tmp_path):
    proc = subprocess.run(
        [sys.executable, str(SEED_PY), "--workdir", str(tmp_path / "r"), "--seed", "7"],
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc.returncode == 0
    bug_md = tmp_path / "r" / "BUG.md"
    assert bug_md.exists()
    content = bug_md.read_text(encoding="utf-8")
    result = json.loads(proc.stdout.strip().splitlines()[-1])
    assert result["title"] in content
    assert "## Description" in content
    assert result["tests_failing_before"] >= 1


def test_all_template_titles_are_distinct(tmp_path):
    titles = [tpl["title"] for tpl in TEMPLATES]
    assert len(set(titles)) == len(titles)
