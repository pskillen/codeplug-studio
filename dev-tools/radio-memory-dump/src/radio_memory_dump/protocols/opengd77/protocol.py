"""OpenGD77 read-only protocol session (no W/X write frames)."""

from __future__ import annotations

from ..base import BytePipe, FirmwareIdent, ReadOnlyProtocol
from .codec import (
    OPENGD77_BLOCK,
    OPENGD77_CMD_CLOSE_CPS,
    OPENGD77_CMD_OK,
    OPENGD77_CMD_SHOW_CPS,
    OPENGD77_FIRMWARE_INFO_SIZE,
    OPENGD77_MEM_FIRMWARE_INFO,
    make_command_frame,
    make_ping_frame,
    make_read_frame,
    parse_command_ack,
    parse_firmware_info,
    parse_read_reply,
    ProtocolError,
)

OPENGD77_BAUD_RATE = 115_200
OPENGD77_IDENT_TIMEOUT_MS = 3000
OPENGD77_IO_TIMEOUT_MS = 5000


class OpenGd77Protocol(ReadOnlyProtocol):
    name = "opengd77"
    default_baud = OPENGD77_BAUD_RATE

    def ident(self, pipe: BytePipe) -> FirmwareIdent:
        pipe.flush()
        pipe.write(make_ping_frame())
        try:
            ping_ack = pipe.read_exact(1, OPENGD77_IDENT_TIMEOUT_MS)
            if ping_ack[0] != OPENGD77_CMD_OK:
                pass  # some firmwares omit or vary ping ACK
        except TimeoutError:
            pass  # ping optional

        payload = self._read_mem(pipe, OPENGD77_MEM_FIRMWARE_INFO, 0, OPENGD77_FIRMWARE_INFO_SIZE)
        info = parse_firmware_info(payload)
        return FirmwareIdent(
            struct_version=int(info["struct_version"]),
            radio_type=int(info["radio_type"]),
            fw_revision=str(info["fw_revision"]),
            build_date=str(info["build_date"]),
            features=int(info["features"]),
        )

    def show_cps(self, pipe: BytePipe) -> None:
        self._send_command(pipe, OPENGD77_CMD_SHOW_CPS)

    def close_cps(self, pipe: BytePipe) -> None:
        self._send_command(pipe, OPENGD77_CMD_CLOSE_CPS)

    def read_region(self, pipe: BytePipe, mem: int, addr: int, length: int) -> bytes:
        out = bytearray(length)
        offset = 0
        while offset < length:
            chunk = min(OPENGD77_BLOCK, length - offset)
            payload = self._read_mem(pipe, mem, addr + offset, chunk)
            out[offset : offset + chunk] = payload
            offset += chunk
        return bytes(out)

    def _send_command(self, pipe: BytePipe, flag: int, payload: bytes | None = None) -> None:
        pipe.write(make_command_frame(flag, payload))
        ack = pipe.read_exact(1, OPENGD77_IO_TIMEOUT_MS)
        parse_command_ack(ack)

    def _read_mem(self, pipe: BytePipe, mem: int, addr: int, length: int) -> bytes:
        pipe.write(make_read_frame(mem, addr, length))
        header = pipe.read_exact(3, OPENGD77_IO_TIMEOUT_MS)
        if header[0] != 0x52:
            raise ProtocolError(f"OpenGD77 read expected 'R', got 0x{header[0]:02x}")
        reply_len = (header[1] << 8) | header[2]
        payload = pipe.read_exact(reply_len, OPENGD77_IO_TIMEOUT_MS)
        return parse_read_reply(header + payload, length)


class TimeoutError(Exception):
    """Serial read timed out."""
