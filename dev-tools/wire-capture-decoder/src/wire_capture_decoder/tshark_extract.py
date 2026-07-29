"""Pull USBCOM (CDC-ACM bulk data) payloads out of a pcapng via tshark.

We shell out to tshark rather than hand-parsing pcapng/USBPcap/URB framing
ourselves — that dissection is already correct and well-tested in Wireshark,
and reimplementing it is exactly the kind of place a subtle bug would make
us silently miss the frame we're hunting for.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .model import Chunk

FIELDS = (
    "frame.number",
    "frame.time_relative",
    "usbcom.data.out_payload",  # host -> radio
    "usbcom.data.in_payload",  # radio -> host
)


class TsharkNotFoundError(RuntimeError):
    pass


def _tshark_path() -> str:
    path = shutil.which("tshark")
    if path is None:
        raise TsharkNotFoundError(
            "tshark not found on PATH. Install it with `brew install wireshark` "
            "(CLI formula, not the GUI cask)."
        )
    return path


def extract_chunks(pcap_path: Path) -> tuple[list[Chunk], list[Chunk]]:
    """Return (host_to_radio_chunks, radio_to_host_chunks), in capture order."""
    tshark = _tshark_path()
    args = [tshark, "-r", str(pcap_path), "-Y", "usbcom.data.out_payload || usbcom.data.in_payload"]
    for f in FIELDS:
        args += ["-e", f]
    args += ["-T", "fields", "-E", "separator=\t", "-E", "occurrence=f"]

    proc = subprocess.run(args, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"tshark failed (exit {proc.returncode}): {proc.stderr.strip()}")

    host_chunks: list[Chunk] = []
    radio_chunks: list[Chunk] = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        cols = line.split("\t")
        cols += [""] * (4 - len(cols))
        frame_no_s, time_s, out_hex, in_hex = cols[:4]
        frame_no = int(frame_no_s)
        time = float(time_s) if time_s else 0.0
        out_hex = out_hex.replace(":", "").strip()
        in_hex = in_hex.replace(":", "").strip()
        if out_hex:
            host_chunks.append(Chunk(frame_no, time, bytes.fromhex(out_hex)))
        if in_hex:
            radio_chunks.append(Chunk(frame_no, time, bytes.fromhex(in_hex)))

    return host_chunks, radio_chunks
