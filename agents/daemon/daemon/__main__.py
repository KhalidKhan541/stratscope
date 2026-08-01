"""Allow ``python -m daemon`` as an alias for ``python -m daemon.daemon``."""

from .daemon import main

if __name__ == "__main__":
    raise SystemExit(main())
