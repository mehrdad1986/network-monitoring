"""Append live checker status to a separate Ubuntu terminal when available."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

LIVE_LOG_ENV = "DNS_CHECKER_LIVE_LOG"


def start_live_terminal(title: str, intro: list[str]) -> str | None:
    """Start tail in a new terminal, or reuse a log path inherited by a child."""
    inherited = os.environ.get(LIVE_LOG_ENV)
    if inherited:
        path = Path(inherited)
        if path.is_file():
            append_live(path, "", title, "=" * 80, *intro, "")
            return str(path)

    if not sys.platform.startswith("linux") or not (
        os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
    ):
        return None

    descriptor, raw_path = tempfile.mkstemp(prefix="dns-checker-live-", suffix=".log")
    os.close(descriptor)
    path = Path(raw_path)
    append_live(path, title, "=" * 80, *intro, "")

    terminals = [
        ("gnome-terminal", lambda exe: [exe, f"--title={title}", "--", "tail", "-n", "+1", "-f", str(path)]),
        ("konsole", lambda exe: [exe, "--separate", "--title", title, "-e", "tail", "-n", "+1", "-f", str(path)]),
        ("xfce4-terminal", lambda exe: [exe, f"--title={title}", "--disable-server", "--execute", "tail", "-n", "+1", "-f", str(path)]),
        ("xterm", lambda exe: [exe, "-T", title, "-e", "tail", "-n", "+1", "-f", str(path)]),
        ("x-terminal-emulator", lambda exe: [exe, "-e", "tail", "-n", "+1", "-f", str(path)]),
    ]
    for name, command in terminals:
        executable = shutil.which(name)
        if not executable:
            continue
        try:
            subprocess.Popen(
                command(executable),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            return str(path)
        except OSError:
            continue
    path.unlink(missing_ok=True)
    return None


def append_live(path: str | Path | None, *lines: str) -> None:
    if not path:
        return
    with Path(path).open("a", encoding="utf-8", buffering=1) as output:
        for line in lines:
            output.write(str(line) + "\n")


def child_environment(path: str | None) -> dict[str, str]:
    environment = os.environ.copy()
    if path:
        environment[LIVE_LOG_ENV] = path
    return environment
