#!/usr/bin/env python3
"""Compatibility entrypoint for the implemented TLS fragmentation experiment."""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().with_name('tls_fragment.py')), run_name='__main__')
