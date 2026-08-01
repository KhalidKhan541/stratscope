"""Synthetic bug generator for the StratScope bug-fixing loop.

Builds a tiny self-contained Python project (a calculator library, a string
utility module, and a pytest suite), applies EXACTLY ONE mutation from a bug
template list, verifies that at least one existing test fails, and writes an
issue-style BUG.md. Deterministic per --seed.

Usage:
    python seed.py --workdir work/scratch-repo --seed 42
"""

from __future__ import annotations

import argparse
import json
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_WORKDIR = Path("work") / "scratch-repo"

BASE_CALC = """\
'''Tiny calculator library used by the bug seeder.'''


def add(a: int, b: int) -> int:
    return a + b


def subtract(a: int, b: int) -> int:
    return a - b


def multiply(a: int, b: int) -> int:
    return a * b


def divide(a: int, b: int) -> float:
    return a / b


def factorial(n: int) -> int:
    if n < 0:
        raise ValueError("factorial is undefined for negative numbers")
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result


def is_positive(n: int) -> bool:
    return n > 0


def parity(n: int) -> str:
    if n % 2 == 0:
        return "even"
    return "odd"
"""

BASE_STRINGS = """\
'''Small string utilities used by the bug seeder.'''


def reverse(s: str) -> str:
    return s[::-1]


def count_vowels(s: str) -> int:
    count = 0
    for ch in s.lower():
        if ch in "aeiou":
            count += 1
    return count


def is_palindrome(s: str) -> bool:
    normalized = s.lower().replace(" ", "")
    return normalized == normalized[::-1]
"""

BASE_TESTS = """\
import pytest

import calc
import strings


@pytest.mark.parametrize("a,b,expected", [(2, 3, 5), (-1, 1, 0), (0, 0, 0)])
def test_add(a, b, expected):
    assert calc.add(a, b) == expected


@pytest.mark.parametrize("a,b,expected", [(10, 4, 6), (0, 5, -5)])
def test_subtract(a, b, expected):
    assert calc.subtract(a, b) == expected


@pytest.mark.parametrize("a,b,expected", [(3, 4, 12), (-2, 5, -10)])
def test_multiply(a, b, expected):
    assert calc.multiply(a, b) == expected


@pytest.mark.parametrize("a,b,expected", [(10, 2, 5.0), (9, 3, 3.0)])
def test_divide(a, b, expected):
    assert calc.divide(a, b) == expected


@pytest.mark.parametrize("n,expected", [(0, 1), (1, 1), (5, 120), (7, 5040)])
def test_factorial(n, expected):
    assert calc.factorial(n) == expected


def test_factorial_negative():
    with pytest.raises(ValueError):
        calc.factorial(-1)


@pytest.mark.parametrize("n,expected", [(3, True), (-3, False), (0, False)])
def test_is_positive(n, expected):
    assert calc.is_positive(n) == expected


@pytest.mark.parametrize("n,expected", [(2, "even"), (3, "odd"), (0, "even")])
def test_parity(n, expected):
    assert calc.parity(n) == expected


@pytest.mark.parametrize("s,expected", [("abc", "cba"), ("", ""), ("a b c", "c b a")])
def test_reverse(s, expected):
    assert strings.reverse(s) == expected


@pytest.mark.parametrize("s,expected", [("hello", 2), ("AEIOU", 5), ("xyz", 0)])
def test_count_vowels(s, expected):
    assert strings.count_vowels(s) == expected


@pytest.mark.parametrize(
    "s,expected",
    [("racecar", True), ("never odd or even", True), ("hello", False)],
)
def test_is_palindrome(s, expected):
    assert strings.is_palindrome(s) == expected
"""


def _make_template(
    name: str,
    module: str,
    title: str,
    description: str,
    before: str,
    after: str,
    revert_before: str | None = None,
    revert_after: str | None = None,
) -> dict:
    """Build a template as a (apply_fn, revert_fn, description) triple.

    `before`/`after` anchor on enough surrounding source so that apply and
    revert are unambiguous in both directions.
    """
    return {
        "name": name,
        "module": module,
        "title": title,
        "description": description,
        "apply": lambda src, b=before, a=after: src.replace(b, a),
        "revert": lambda src, b=revert_before or after, a=revert_after or before: src.replace(b, a),
    }


def _build_templates() -> list[dict]:
    return [
        _make_template(
            name="off_by_one",
            module="calc.py",
            title="Bug: factorial returns wrong value for n=5",
            description=(
                "`factorial(n)` skips the last multiplier for any `n >= 1` because the loop "
                "range bound is off by one.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from calc import factorial\n"
                ">>> factorial(5)\n"
                "24\n"
                "```\n\n"
                "Expected `factorial(5) == 120`, got `24`. The bug is isolated to the loop "
                "boundary: `factorial(0)` and `factorial(1)` are unaffected, so naive spot "
                "checks can miss it."
            ),
            before="    for i in range(1, n + 1):",
            after="    for i in range(1, n):",
        ),
        _make_template(
            name="wrong_operator",
            module="calc.py",
            title="Bug: subtract returns wrong value for a=10, b=4",
            description=(
                "`subtract(a, b)` returns `a + b` instead of `a - b`, so every call produces "
                "the wrong result.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from calc import subtract\n"
                ">>> subtract(10, 4)\n"
                "14\n"
                "```\n\n"
                "Expected `6`, got `14`."
            ),
            before="def subtract(a: int, b: int) -> int:\n    return a - b",
            after="def subtract(a: int, b: int) -> int:\n    return a + b",
        ),
        _make_template(
            name="swapped_args",
            module="calc.py",
            title="Bug: divide returns wrong value for a=10, b=2",
            description=(
                "`divide(a, b)` divides the arguments in the wrong order — it computes "
                "`b / a` instead of `a / b`.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from calc import divide\n"
                ">>> divide(10, 2)\n"
                "0.2\n"
                "```\n\n"
                "Expected `5.0`, got `0.2`."
            ),
            before="def divide(a: int, b: int) -> float:\n    return a / b",
            after="def divide(a: int, b: int) -> float:\n    return b / a",
        ),
        _make_template(
            name="wrong_constant",
            module="strings.py",
            title="Bug: count_vowels returns wrong count for 'hello'",
            description=(
                "`count_vowels(s)` starts its counter at `1` instead of `0`, so every result "
                "is exactly one higher than the true vowel count.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from strings import count_vowels\n"
                ">>> count_vowels(\"hello\")\n"
                "3\n"
                "```\n\n"
                "Expected `2`, got `3`."
            ),
            before="    count = 0",
            after="    count = 1",
        ),
        _make_template(
            name="inverted_condition",
            module="calc.py",
            title="Bug: is_positive returns wrong result for positive input",
            description=(
                "`is_positive(n)` reports `True` for negative numbers and `False` for positive "
                "ones because the comparison is inverted.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from calc import is_positive\n"
                ">>> is_positive(3)\n"
                "False\n"
                "```\n\n"
                "Expected `True`, got `False`."
            ),
            before="    return n > 0",
            after="    return n < 0",
        ),
        _make_template(
            name="missing_return",
            module="calc.py",
            title="Bug: parity returns None for odd numbers",
            description=(
                "`parity(n)` returns `None` for odd inputs because the odd branch is missing "
                "its `return` statement; only the even branch returns a value.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from calc import parity\n"
                ">>> parity(3)\n"
                "None\n"
                "```\n\n"
                "Expected `\"odd\"`, got `None`."
            ),
            before='    return "odd"\n',
            after="",
            revert_before='        return "even"\n',
            revert_after='        return "even"\n    return "odd"\n',
        ),
        _make_template(
            name="off_by_sign",
            module="calc.py",
            title="Bug: add returns negative result for positive inputs",
            description=(
                "`add(a, b)` returns the negated sum, so any call with positive arguments "
                "comes back negative.\n\n"
                "Reproduction:\n"
                "```python\n"
                ">>> from calc import add\n"
                ">>> add(2, 3)\n"
                "-5\n"
                "```\n\n"
                "Expected `5`, got `-5`."
            ),
            before="def add(a: int, b: int) -> int:\n    return a + b",
            after="def add(a: int, b: int) -> int:\n    return -(a + b)",
        ),
    ]


TEMPLATES = _build_templates()


def write_base_project(workdir: Path) -> None:
    """Write the pristine scratch project (library modules + tests)."""
    workdir.mkdir(parents=True, exist_ok=True)
    (workdir / "calc.py").write_text(BASE_CALC, encoding="utf-8")
    (workdir / "strings.py").write_text(BASE_STRINGS, encoding="utf-8")
    (workdir / "tests").mkdir(exist_ok=True)
    (workdir / "tests" / "test_lib.py").write_text(BASE_TESTS, encoding="utf-8")


def count_failing_tests(workdir: Path, timeout: int = 120) -> int:
    """Run pytest in `workdir` and return the number of failing/erroring tests."""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider"],
        cwd=str(workdir),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    output = proc.stdout + proc.stderr
    failures = re.search(r"(\d+) failed", output)
    errors = re.search(r"(\d+) error", output)
    return (int(failures.group(1)) if failures else 0) + (int(errors.group(1)) if errors else 0)


def choose_template(workdir: Path, rng: random.Random) -> tuple[dict, int]:
    """Pick the first template (random order) whose mutation fails >=1 test.

    A mutation that fails no test is reverted and the next template is tried.
    """
    candidates = list(TEMPLATES)
    rng.shuffle(candidates)
    for tpl in candidates:
        module_path = workdir / tpl["module"]
        original = module_path.read_text(encoding="utf-8")
        module_path.write_text(tpl["apply"](original), encoding="utf-8")
        failing = count_failing_tests(workdir)
        if failing >= 1:
            return tpl, failing
        module_path.write_text(original, encoding="utf-8")
    raise RuntimeError("no bug template produced at least one failing test")


def build_bug_md(title: str, description: str) -> str:
    return (
        f"# {title}\n\n"
        "## Description\n\n"
        f"{description}\n\n"
        "## How to reproduce\n\n"
        "```bash\n"
        "python -m pytest tests -q\n"
        "```\n"
    )


def main(argv: list[str] | None = None) -> dict:
    parser = argparse.ArgumentParser(description="Generate a synthetic bug in a scratch repo.")
    parser.add_argument(
        "--workdir",
        default=str(DEFAULT_WORKDIR),
        help=f"Target directory for the scratch repo (default: {DEFAULT_WORKDIR})",
    )
    parser.add_argument("--seed", type=int, default=None, help="RNG seed for reproducibility")
    args = parser.parse_args(argv)

    workdir = Path(args.workdir)
    rng = random.Random(args.seed) if args.seed is not None else random.Random()
    if workdir.exists():
        shutil.rmtree(workdir)
    write_base_project(workdir)
    tpl, failing = choose_template(workdir, rng)
    title = tpl["title"]
    body = build_bug_md(title, tpl["description"])
    (workdir / "BUG.md").write_text(body, encoding="utf-8")

    result = {
        "workdir": str(workdir),
        "title": title,
        "body": body,
        "bug": tpl["name"],
        "tests_failing_before": failing,
        "seed": args.seed,
    }
    print(json.dumps(result))
    return result


if __name__ == "__main__":
    main()
