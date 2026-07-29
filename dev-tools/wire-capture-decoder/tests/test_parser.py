from wire_capture_decoder.model import Chunk
from wire_capture_decoder.parser import checksum8, decode_frames


def _write_frame(addr: int, payload: bytes) -> bytes:
    assert len(payload) == 16
    body = addr.to_bytes(4, "big") + bytes([0x10]) + payload
    return b"\x57" + body + bytes([checksum8(body)]) + b"\x06"


def _read_reply(addr: int, payload: bytes) -> bytes:
    body = addr.to_bytes(4, "big") + bytes([len(payload)]) + payload
    return b"\x57" + body + bytes([checksum8(body)]) + b"\x06"


def test_boring_session_roundtrip():
    write_cmd = _write_frame(0x1000000, bytes(range(16)))
    host = (
        b"PROGRAM"
        + b"\x02"
        + write_cmd
        + b"END"
    )
    radio = (
        b"QX\x06"
        + b"ID890UV\x00\x00V100\x00\x00\x06"
        + b"\x06"  # write ack
    )
    host_chunks = [Chunk(1, 0.0, host)]
    radio_chunks = [Chunk(2, 0.0, radio)]

    frames, _h, _r = decode_frames(host_chunks, radio_chunks)
    kinds = [f.kind for f in frames]
    assert kinds == [
        "PROGRAM",
        "PROGRAM_REPLY",
        "IDENT_PROBE",
        "IDENT_REPLY",
        "WRITE_CMD",
        "WRITE_ACK",
        "END",
    ]
    write_frame = next(f for f in frames if f.kind == "WRITE_CMD")
    assert write_frame.checksum_ok is True
    assert write_frame.fields["address"] == 0x1000000
    assert not any(f.is_unknown() for f in frames)


def test_read_during_write_and_unknown_injection():
    read_cmd = b"\x52" + (0x2100000).to_bytes(4, "big") + bytes([0x10])
    write_cmd = _write_frame(0x1000000, bytes(range(16)))
    injected = b"\xAB\xCD\xEF"  # not a valid shape anywhere
    host = b"PROGRAM" + write_cmd + read_cmd + injected + b"END"
    radio = (
        b"QX\x06"
        + b"\x06"  # write ack
        + _read_reply(0x2100000, bytes([0xFE] * 16))
        + b"\x06"  # something answering the injected bytes, terminated by an ack-like 0x06
    )
    host_chunks = [Chunk(1, 0.0, host)]
    radio_chunks = [Chunk(2, 0.0, radio)]

    frames, _h, _r = decode_frames(host_chunks, radio_chunks)
    kinds = [f.kind for f in frames]
    assert "UNKNOWN_HOST" in kinds
    unk = next(f for f in frames if f.kind == "UNKNOWN_HOST")
    assert unk.raw == injected

    read_reply = next(f for f in frames if f.kind == "READ_REPLY")
    assert read_reply.fields["address"] == 0x2100000
    assert read_reply.checksum_ok is True


def test_checksum_mismatch_is_flagged_not_hidden():
    good = _write_frame(0x1000000, bytes(range(16)))
    corrupted = bytearray(good)
    corrupted[-2] ^= 0xFF  # break the checksum byte (last byte is the 0x06 terminator)
    host = b"PROGRAM" + bytes(corrupted) + b"END"
    radio = b"QX\x06" + b"\x06"
    frames, _h, _r = decode_frames([Chunk(1, 0.0, host)], [Chunk(2, 0.0, radio)])
    write_frame = next(f for f in frames if f.kind == "WRITE_CMD")
    assert write_frame.checksum_ok is False


def test_capture_cut_off_before_last_reply_is_surfaced_not_dropped():
    write_cmd = _write_frame(0x1000000, bytes(range(16)))
    host = b"PROGRAM" + write_cmd  # capture stops here — no ack, no END
    radio = b"QX\x06"  # radio stream also ends before the write ack
    frames, _h, _r = decode_frames([Chunk(1, 0.0, host)], [Chunk(2, 0.0, radio)])
    missing = next(f for f in frames if f.kind == "MISSING_RADIO_REPLY")
    assert missing.length == 0
    assert "capture likely stopped" in missing.note
    assert missing.note  # non-empty note makes it show up as notable in the report
