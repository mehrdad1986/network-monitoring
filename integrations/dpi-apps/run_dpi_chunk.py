#!/usr/bin/env python3
"""Run the chunked subscription probe."""
import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().with_name("run_chunked.py")), run_name="__main__")
