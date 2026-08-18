"""
OpenGD77 USB serial framing — matches Studio opengd77Serial.ts.

Cite: docs/reference/radios/opengd77/protocol.md (facts only; no GPL copy).
"""

from __future__ import annotations

OPENGD77_BLOCK = 32
OPENGD77_CMD_OK = 0x2d  # '-'

OPENGD77_TYPE_COMMAND = 0x43  # 'C'
OPENGD77_TYPE_READ = 0x52  # 'R'
OPENGD77_TYPE_WRITE_GD77 = 0x57  # 'W'
OPENGD77_TYPE_WRITE_UV380 = 0x58  # 'X'

OPENGD77_PING_FLAG = 0xfe

OPENGD77_FIRMWARE_INFO_SIZE = 46

OPENGD77_CMD_SHOW_CPS = 0x00
OPENGD77_CMD_CLOSE_CPS = 0x05

# Documented 'R' mem codes (protocol.md).
OPENGD77_MEM_FLASH = 0x01
OPENGD77_MEM_EEPROM = 0x02
OPENGD77_MEM_MCU_ROM = 0x05
OPENGD77_MEM_DISPLAY = 0x06
OPENGD77_MEM_WAV = 0x07
OPENGD77_MEM_AMBE = 0x08
OPENGD77_MEM_FIRMWARE_INFO = 0x09
OPENGD77_MEM_FLASH_SECURITY = 0x0a

MEM_ALIASES: dict[str, int] = {
    "flash": OPENGD77_MEM_FLASH,
    "01": OPENGD77_MEM_FLASH,
    "0x01": OPENGD77_MEM_FLASH,
    "eeprom": OPENGD77_MEM_EEPROM,
    "02": OPENGD77_MEM_EEPROM,
    "0x02": OPENGD77_MEM_EEPROM,
    "mcu-rom": OPENGD77_MEM_MCU_ROM,
    "05": OPENGD77_MEM_MCU_ROM,
    "0x05": OPENGD77_MEM_MCU_ROM,
    "display": OPENGD77_MEM_DISPLAY,
    "06": OPENGD77_MEM_DISPLAY,
    "0x06": OPENGD77_MEM_DISPLAY,
    "wav": OPENGD77_MEM_WAV,
    "07": OPENGD77_MEM_WAV,
    "0x07": OPENGD77_MEM_WAV,
    "ambe": OPENGD77_MEM_AMBE,
    "08": OPENGD77_MEM_AMBE,
    "0x08": OPENGD77_MEM_AMBE,
    "firmware-info": OPENGD77_MEM_FIRMWARE_INFO,
    "09": OPENGD77_MEM_FIRMWARE_INFO,
    "0x09": OPENGD77_MEM_FIRMWARE_INFO,
    "flash-security": OPENGD77_MEM_FLASH_SECURITY,
    "0a": OPENGD77_MEM_FLASH_SECURITY,
    "0x0a": OPENGD77_MEM_FLASH_SECURITY,
}


class ProtocolError(Exception):
    """Framing or reply mismatch."""


def _assert_u8(value: int, label: str) -> None:
    if not isinstance(value, int) or value < 0 or value > 0xff:
        raise ValueError(f"{label} must be u8, got {value}")


def _assert_u16(value: int, label: str) -> None:
    if not isinstance(value, int) or value < 0 or value > 0xffff:
        raise ValueError(f"{label} must be u16, got {value}")


def _assert_u32(value: int, label: str) -> None:
    if not isinstance(value, int) or value < 0 or value > 0xffffffff:
        raise ValueError(f"{label} must be u32, got {value}")


def make_ping_frame() -> bytes:
    return bytes([OPENGD77_TYPE_COMMAND, OPENGD77_PING_FLAG])


def make_command_frame(flag: int, payload: bytes | None = None) -> bytes:
    _assert_u8(flag, "command flag")
    extra = payload or b""
    return bytes([OPENGD77_TYPE_COMMAND, flag]) + extra


def parse_command_ack(frame: bytes) -> None:
    if len(frame) != 1 or frame[0] != OPENGD77_CMD_OK:
        got = frame[0] if frame else None
        raise ProtocolError(f"OpenGD77 command expected ACK '-', got {len(frame)} byte(s) 0x{got:02x}")


def make_read_frame(mem: int, addr: int, length: int) -> bytes:
    """8-byte read request: R + mem + addr u32 BE + length u16 BE."""
    _assert_u8(mem, "mem code")
    _assert_u32(addr, "read address")
    _assert_u16(length, "read length")
    return bytes(
        [
            OPENGD77_TYPE_READ,
            mem,
            (addr >> 24) & 0xff,
            (addr >> 16) & 0xff,
            (addr >> 8) & 0xff,
            addr & 0xff,
            (length >> 8) & 0xff,
            length & 0xff,
        ]
    )


def parse_read_reply(frame: bytes, expected_length: int | None = None) -> bytes:
    """Parse data reply: R + length u16 BE + payload."""
    if len(frame) < 3:
        raise ProtocolError(f"OpenGD77 read reply too short: {len(frame)} bytes")
    if frame[0] != OPENGD77_TYPE_READ:
        raise ProtocolError(f"OpenGD77 read reply expected 'R', got 0x{frame[0]:02x}")
    length = (frame[1] << 8) | frame[2]
    payload = frame[3:]
    if len(payload) != length:
        raise ProtocolError(
            f"OpenGD77 read reply payload length {len(payload)} != header length {length}"
        )
    if expected_length is not None and len(payload) != expected_length:
        raise ProtocolError(
            f"OpenGD77 read reply payload length {len(payload)} != expected {expected_length}"
        )
    return payload


def parse_firmware_info(payload: bytes) -> dict[str, int | str]:
    if len(payload) < OPENGD77_FIRMWARE_INFO_SIZE:
        raise ProtocolError(
            f"FirmwareInfo expected {OPENGD77_FIRMWARE_INFO_SIZE} bytes, got {len(payload)}"
        )
    struct_version = int.from_bytes(payload[0:4], "little")
    radio_type = int.from_bytes(payload[4:8], "little")

    def read_ascii_pad(offset: int, length: int) -> str:
        chunk = payload[offset : offset + length]
        end = chunk.find(0)
        if end == -1:
            end = length
        text = chunk[:end].decode("ascii", errors="ignore")
        return text.strip()

    fw_revision = read_ascii_pad(8, 16)
    build_date = read_ascii_pad(24, 16)
    features = payload[44] | (payload[45] << 8)
    return {
        "struct_version": struct_version,
        "radio_type": radio_type,
        "fw_revision": fw_revision,
        "build_date": build_date,
        "features": features,
    }


_CANONICAL_LABELS: dict[int, str] = {
    OPENGD77_MEM_FLASH: "flash",
    OPENGD77_MEM_EEPROM: "eeprom",
    OPENGD77_MEM_MCU_ROM: "mcu-rom",
    OPENGD77_MEM_DISPLAY: "display",
    OPENGD77_MEM_WAV: "wav",
    OPENGD77_MEM_AMBE: "ambe",
    OPENGD77_MEM_FIRMWARE_INFO: "firmware-info",
    OPENGD77_MEM_FLASH_SECURITY: "flash-security",
}


def mem_label(mem: int) -> str:
    return _CANONICAL_LABELS.get(mem, f"0x{mem:02x}")


def parse_mem_token(token: str) -> tuple[int, str]:
    key = token.strip().lower()
    if key not in MEM_ALIASES:
        raise ValueError(f"Unknown mem region '{token}'")
    code = MEM_ALIASES[key]
    return code, mem_label(code)


def parse_int_token(token: str, label: str) -> int:
    text = token.strip().lower()
    if text.startswith("0x"):
        return int(text, 16)
    return int(text, 10)


def parse_region_spec(spec: str) -> tuple[int, str, int, int]:
    parts = spec.split(":")
    if len(parts) != 3:
        raise ValueError(f"Region spec must be mem:addr:length, got '{spec}'")
    mem, mem_label = parse_mem_token(parts[0])
    addr = parse_int_token(parts[1], "addr")
    length = parse_int_token(parts[2], "length")
    if length <= 0:
        raise ValueError(f"Region length must be positive, got {length}")
    return mem, mem_label, addr, length
