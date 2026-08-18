"""Tests for OpenGD77 frame encode/decode."""

from radio_memory_dump.protocols.opengd77.codec import (
    OPENGD77_CMD_OK,
    OPENGD77_FIRMWARE_INFO_SIZE,
    make_command_frame,
    make_ping_frame,
    make_read_frame,
    parse_command_ack,
    parse_firmware_info,
    parse_int_token,
    parse_mem_token,
    parse_read_reply,
    parse_region_spec,
)


def test_ping_frame():
    assert make_ping_frame() == bytes([0x43, 0xfe])


def test_command_show_cps():
    assert make_command_frame(0x00) == bytes([0x43, 0x00])


def test_read_frame_flash_0x3780_32():
    frame = make_read_frame(0x01, 0x3780, 32)
    assert frame == bytes(
        [
            0x52,
            0x01,
            0x00,
            0x00,
            0x37,
            0x80,
            0x00,
            0x20,
        ]
    )


def test_read_reply_parse():
    payload = bytes(range(16))
    frame = bytes([0x52, 0x00, 0x10]) + payload
    assert parse_read_reply(frame, 16) == payload


def test_command_ack():
    parse_command_ack(bytes([OPENGD77_CMD_OK]))


def test_firmware_info_parse():
    buf = bytearray(OPENGD77_FIRMWARE_INFO_SIZE)
    buf[0:4] = (3).to_bytes(4, "little")
    buf[4:8] = (0x05).to_bytes(4, "little")
    buf[8:8 + 5] = b"R01.5"
    buf[24:24 + 14] = b"20240101120000"
    info = parse_firmware_info(bytes(buf))
    assert info["struct_version"] == 3
    assert info["radio_type"] == 0x05
    assert info["fw_revision"] == "R01.5"
    assert info["build_date"] == "20240101120000"


def test_mem_aliases():
    assert parse_mem_token("flash") == (0x01, "flash")
    assert parse_mem_token("0x02") == (0x02, "eeprom")
    assert parse_mem_token("firmware-info") == (0x09, "firmware-info")


def test_region_spec():
    mem, label, addr, length = parse_region_spec("flash:0x3780:32")
    assert mem == 0x01
    assert label == "flash"
    assert addr == 0x3780
    assert length == 32


def test_parse_int_decimal_and_hex():
    assert parse_int_token("3780", "addr") == 3780
    assert parse_int_token("0x3780", "addr") == 0x3780
