"""Fake bugfixer runner for tests: prints the contract JSON line to stdout.

Behavior is controlled by env vars (see tests/test_worker.py):

- FAKE_STATUS      status field, default "completed"
- FAKE_EXECUTION_ID execution_id field, default "fake-exec-1"
- FAKE_TESTS_PASSED "true"/"false", default "true"
- FAKE_CHANGES     changes field, default 2
- FAKE_EXIT_CODE   process exit code, default 0
"""

import json
import os
import sys


def main() -> int:
    payload = {
        "execution_id": os.environ.get("FAKE_EXECUTION_ID", "fake-exec-1"),
        "status": os.environ.get("FAKE_STATUS", "completed"),
        "tests_passed": os.environ.get("FAKE_TESTS_PASSED", "true").lower() == "true",
        "changes": int(os.environ.get("FAKE_CHANGES", "2")),
    }
    print(json.dumps(payload))
    return int(os.environ.get("FAKE_EXIT_CODE", "0"))


if __name__ == "__main__":
    sys.exit(main())
