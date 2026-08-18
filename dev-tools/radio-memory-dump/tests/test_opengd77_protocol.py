"""Tests for OpenGD77 read-only protocol session."""

from radio_memory_dump.protocols.opengd77.codec import (
    OPENGD77_CMD_OK,
    OPENGD77_FIRMWARE_INFO_SIZE,
    OPENGD77_MEM_EEPROM,
    OPENGD77_MEM_FLASH,
    make_command_frame,
    make_ping_frame,
    make_read_frame,
)
from radio_memory_dump.protocols.opengd77.protocol import OpenGd77Protocol
from fake_pipe import FakeBytePipe


def _firmware_info_payload() -> bytes:
    buf = bytearray(OPENGD77_FIRMWARE_INFO_SIZE)
    buf[0:4] = (3).to_bytes(4, "little")
    buf[4:8] = (0x05).to_bytes(4, "little")
    buf[8:8 + 6] = b"MD9600"
    buf[24:24 + 14] = b"20240101120000"
    return bytes(buf)


def _read_reply(mem: int, addr: int, length: int, payload: bytes) -> bytes:
    del mem, addr
    header = bytes([0x52, (length >> 8) & 0xff, length & 0xff])
    return header + payload


def test_ident_reads_firmware_info():
    info_payload = _firmware_info_payload()
    pipe = FakeBytePipe(
        responses=[
            bytes([OPENGD77_CMD_OK]),  # optional ping ACK
            _read_reply(0x09, 0, OPENGD77_FIRMWARE_INFO_SIZE, info_payload),
        ]
    )
    protocol = OpenGd77Protocol()
    ident = protocol.ident(pipe)
    assert ident.radio_type == 0x05
    assert ident.fw_revision == "MD9600"
    assert pipe.written[0] == make_ping_frame()
    assert pipe.written[1] == make_read_frame(0x09, 0, OPENGD77_FIRMWARE_INFO_SIZE)


def test_show_cps_sends_command_ack():
    pipe = FakeBytePipe(responses=[bytes([OPENGD77_CMD_OK])])
    OpenGd77Protocol().show_cps(pipe)
    assert pipe.written[0] == make_command_frame(0x00)


def test_read_region_chunks_at_32_bytes():
    flash_a = bytes(range(32))
    flash_b = bytes(range(32, 64))
    pipe = FakeBytePipe(
        responses=[
            _read_reply(OPENGD77_MEM_FLASH, 0x3780, 32, flash_a),
            _read_reply(OPENGD77_MEM_FLASH, 0x3780 + 32, 32, flash_b),
        ]
    )
    protocol = OpenGd77Protocol()
    data = protocol.read_region(pipe, OPENGD77_MEM_FLASH, 0x3780, 64)
    assert data == flash_a + flash_b
    assert pipe.written[0] == make_read_frame(OPENGD77_MEM_FLASH, 0x3780, 32)
    assert pipe.written[1] == make_read_frame(OPENGD77_MEM_FLASH, 0x3780 + 32, 32)


def test_read_eeprom_region():
    payload = bytes([0xaa] * 16)
    pipe = FakeBytePipe(responses=[_read_reply(OPENGD77_MEM_EEPROM, 0x3780, 16, payload)])
    protocol = OpenGd77Protocol()
    data = protocol.read_region(pipe, OPENGD77_MEM_EEPROM, 0x3780, 16)
    assert data == payload
    assert pipe.written[0] == make_read_frame(OPENGD77_MEM_EEPROM, 0x3780, 16)
