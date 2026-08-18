"""CLI for read-only radio memory dumps."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .hex_dump import print_hex_dump
from .manifest import DumpManifest, RegionRecord, utc_now_iso
from .protocols.base import FirmwareIdent, RegionSpec
from .protocols.opengd77.codec import parse_region_spec
from .protocols.registry import get_protocol, protocol_names
from .serial_pipe import list_serial_ports, SerialBytePipe

WRITE_FLAG_NAMES = frozenset(
    {
        "write",
        "program",
        "erase",
        "upload",
        "w",
        "x",
    }
)


def region_filename(mem_label: str, addr: int, length: int) -> str:
    safe = mem_label.replace("/", "-")
    return f"{safe}_0x{addr:x}_{length}.bin"


def parse_regions(specs: list[str]) -> list[RegionSpec]:
    regions: list[RegionSpec] = []
    for spec in specs:
        mem, mem_label, addr, length = parse_region_spec(spec)
        regions.append(RegionSpec(mem=mem, mem_label=mem_label, addr=addr, length=length))
    return regions


def refuse_write_flags(argv: list[str]) -> None:
    for arg in argv:
        stripped = arg.strip().lstrip("-").lower()
        if stripped in WRITE_FLAG_NAMES:
            raise SystemExit(f"Refusing write/program flag '{arg}' — tool is read-only")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="radio-memory-dump",
        description="Read-only serial memory dump for radio protocol investigation.",
    )
    parser.add_argument(
        "--protocol",
        choices=protocol_names(),
        help="Protocol plugin (default: opengd77 when dumping)",
    )
    parser.add_argument("--port", help="Serial port device path")
    parser.add_argument("--baud", type=int, help="Serial baud rate (protocol default if omitted)")
    parser.add_argument("--list-ports", action="store_true", help="List serial ports and exit")
    parser.add_argument("--ident", action="store_true", help="Read firmware info before regions")
    parser.add_argument("--show-cps", action="store_true", help="Send SHOW_CPS before region reads")
    parser.add_argument(
        "--close-cps",
        action="store_true",
        help="Send CLOSE_CPS after dump (default when --show-cps was used)",
    )
    parser.add_argument(
        "--region",
        action="append",
        default=[],
        metavar="MEM:ADDR:LENGTH",
        help="Named region to read (repeatable), e.g. flash:0x3780:32",
    )
    parser.add_argument("--out", type=Path, help="Output directory for .bin files and manifest.json")
    return parser


def run_list_ports() -> None:
    ports = list_serial_ports()
    if not ports:
        print("No serial ports found.")
        return
    for device in ports:
        print(device)


def run_dump(args: argparse.Namespace) -> int:
    protocol_name = args.protocol or "opengd77"
    protocol = get_protocol(protocol_name)
    baud = args.baud if args.baud is not None else protocol.default_baud

    if not args.port:
        print("error: --port is required for memory dump", file=sys.stderr)
        return 2
    if not args.region:
        print("error: at least one --region is required", file=sys.stderr)
        return 2
    if not args.out:
        print("error: --out is required for memory dump", file=sys.stderr)
        return 2

    regions = parse_regions(args.region)
    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    ident: FirmwareIdent | None = None
    pipe = SerialBytePipe(args.port, baud)
    show_cps_sent = False
    try:
        if args.ident:
            ident = protocol.ident(pipe)
            print(
                f"ident: radioType=0x{ident.radio_type:x} fw={ident.fw_revision} build={ident.build_date}"
            )

        if args.show_cps:
            protocol.show_cps(pipe)
            show_cps_sent = True
            print("show-cps: ACK")

        manifest = DumpManifest(
            protocol=protocol_name,
            port=args.port,
            baud=baud,
            captured_at=utc_now_iso(),
            firmware=ident.fw_revision if ident else None,
            radio_type=ident.radio_type if ident else None,
        )

        for region in regions:
            data = protocol.read_region(pipe, region.mem, region.addr, region.length)
            filename = region_filename(region.mem_label, region.addr, region.length)
            bin_path = out_dir / filename
            bin_path.write_bytes(data)

            print(f"region {region.mem_label} @0x{region.addr:x} len={region.length} -> {filename}")
            print_hex_dump(data, prefix="  ")

            manifest.regions.append(
                RegionRecord(
                    mem=region.mem,
                    mem_label=region.mem_label,
                    addr=region.addr,
                    length=region.length,
                    path=filename,
                )
            )

        manifest.write(out_dir)
        print(f"manifest: {out_dir / 'manifest.json'}")

        if show_cps_sent or args.close_cps:
            protocol.close_cps(pipe)
            print("close-cps: ACK")

        return 0
    finally:
        pipe.close()


def main(argv: list[str] | None = None) -> None:
    argv = list(argv if argv is not None else sys.argv[1:])
    refuse_write_flags(argv)

    parser = build_parser()
    args = parser.parse_args(argv)

    if args.list_ports:
        run_list_ports()
        raise SystemExit(0)

    if args.region or args.out or args.port or args.ident or args.show_cps:
        code = run_dump(args)
        raise SystemExit(code)

    parser.print_help()
    raise SystemExit(2)
