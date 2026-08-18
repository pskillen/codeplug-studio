"""16-byte row hex dump to stdout."""

from __future__ import annotations


def print_hex_dump(data: bytes, prefix: str = "") -> None:
    for offset in range(0, len(data), 16):
        chunk = data[offset : offset + 16]
        hex_part = " ".join(f"{b:02x}" for b in chunk)
        ascii_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        print(f"{prefix}{offset:08x}  {hex_part:<47}  {ascii_part}")
