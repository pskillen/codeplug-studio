#!/usr/bin/env python3
"""CLI: decode a USBPcap capture of the AT-D890UV CPS wire protocol.

Usage:
    python -m wire_capture_decoder decode <capture.pcapng> [--out report.md] [--json frames.json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import report as report_mod
from .parser import decode_frames
from .tshark_extract import TsharkNotFoundError, extract_chunks


def _frame_to_jsonable(f) -> dict:  # noqa: ANN001
    return {
        "kind": f.kind,
        "direction": f.direction,
        "offset": f.offset,
        "length": f.length,
        "hex": f.hex,
        "fields": f.fields,
        "checksum_ok": f.checksum_ok,
        "frame_numbers": f.frame_numbers,
        "time_range": list(f.time_range),
        "note": f.note,
    }


def cmd_decode(args: argparse.Namespace) -> int:
    pcap_path = Path(args.pcap)
    if not pcap_path.exists():
        print(f"error: no such file: {pcap_path}", file=sys.stderr)
        return 1

    try:
        host_chunks, radio_chunks = extract_chunks(pcap_path)
    except TsharkNotFoundError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if not host_chunks and not radio_chunks:
        print(
            "warning: no usbcom.data.out_payload/in_payload found — is this a "
            "USBPcap capture of the correct CDC data endpoint?",
            file=sys.stderr,
        )

    frames, _host, _radio = decode_frames(host_chunks, radio_chunks)
    text = report_mod.build_report(frames, source_name=pcap_path.name)

    if args.out:
        Path(args.out).write_text(text)
        print(f"wrote report: {args.out}")
    else:
        print(text)

    if args.json:
        Path(args.json).write_text(json.dumps([_frame_to_jsonable(f) for f in frames], indent=2))
        print(f"wrote frame JSON: {args.json}")

    return 0


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="wire-capture-decoder")
    sub = parser.add_subparsers(dest="command", required=True)

    p_decode = sub.add_parser("decode", help="decode a pcapng capture into a report")
    p_decode.add_argument("pcap", help="path to a .pcapng capture")
    p_decode.add_argument("--out", help="write the markdown report to this path (default: stdout)")
    p_decode.add_argument("--json", help="also write the full decoded frame list as JSON")
    p_decode.set_defaults(func=cmd_decode)

    args = parser.parse_args(argv)
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
