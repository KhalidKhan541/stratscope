# Publishing stratscope to PyPI

These steps are for someone with PyPI credentials. Do not run them without a
token — publish only intentionally.

## Prerequisites

- Python 3.9+ with `pip`
- `build` and `twine` installed: `python -m pip install build twine`
- A PyPI API token scoped to the `stratscope` project, created at
  https://pypi.org/manage/account/token/ (select "Project: stratscope" scope).
  If you publish to TestPyPI first, create a separate token at
  https://test.pypi.org/manage/account/token/.
- The name `stratscope` is free on PyPI (verified 404 /
  "No matching distribution" on 2026-08-01). Re-check before publishing:
  `python -m pip index versions stratscope` — no versions / 404 means it is free.

## Build

From this directory (`sdk/python`):

```bash
python -m build
```

This produces `dist/stratscope-0.1.0.tar.gz` (sdist) and
`dist/stratscope-0.1.0-py3-none-any.whl` (wheel). Validate the metadata:

```bash
python -m twine check dist/*
```

## Publish to TestPyPI (recommended first)

```bash
python -m twine upload --repository testpypi dist/*
```

When prompted, use `__token__` as the username and your TestPyPI API token as
the password (or set `TWINE_USERNAME=__token__` and `TWINE_PASSWORD`).

Verify the listing at https://test.pypi.org/project/stratscope/, then smoke
test from a clean environment:

```bash
python -m venv /tmp/pypi-smoke-venv
/tmp/pypi-smoke-venv/bin/python -m pip install --index-url https://test.pypi.org/simple/ stratscope
/tmp/pypi-smoke-venv/bin/python -c "import stratscope; print(stratscope.__version__)"
```

## Publish to PyPI

```bash
python -m twine upload dist/*
```

Use `__token__` as the username and your PyPI API token (scope: `stratscope`)
as the password.

## Verify

```bash
python -m pip install --upgrade stratscope
python -c "import stratscope; print(stratscope.__version__)"
```

Expected output: `0.1.0`.

## Notes

- Bump the version in `pyproject.toml` **and** in
  `stratscope/__init__.py` (`__version__`) for every release — they must stay
  in sync.
- The build backend is setuptools; there are no runtime dependencies.
- Run the test suite before publishing: `python -m pytest tests -q` (12 tests).
