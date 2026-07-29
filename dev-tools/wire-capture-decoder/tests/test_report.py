from wire_capture_decoder.model import HOST_TO_RADIO, RADIO_TO_HOST, ProtocolFrame
from wire_capture_decoder.report import build_report, frame_inventory, unknown_frames_detail


def _write(addr, ok=True):
    return ProtocolFrame(
        "WRITE_CMD",
        HOST_TO_RADIO,
        0,
        24,
        b"\x57" + addr.to_bytes(4, "big") + b"\x10" + bytes(16) + b"\x00\x06",
        fields={"address": addr, "length": 0x10, "data": "00" * 16},
        checksum_ok=ok,
    )


def test_inventory_groups_by_kind_not_address():
    frames = [_write(0x1000000), _write(0x2000000), _write(0x3000000)]
    table = frame_inventory(frames)
    assert table.count("WRITE_CMD") == 1  # one row, not one per address
    assert "| 3 |" in table


def test_checksum_failure_surfaces_even_though_kind_is_known():
    good = _write(0x1000000, ok=True)
    bad = _write(0x2000000, ok=False)
    frames = [good, bad]
    detail = unknown_frames_detail(frames)
    assert "Anomalous frame" in detail
    assert "57 02 00 00 00" in detail


def test_reply_mismatch_note_surfaces_without_checksum_failure():
    reply = ProtocolFrame(
        "READ_REPLY", RADIO_TO_HOST, 0, 24, b"\x57" + bytes(22),
        fields={"address": 0x99, "length": 16, "data": "00"},
        checksum_ok=True,
        note="address mismatch: requested 0x00000001, replied 0x00000099",
    )
    frames = [reply]
    detail = unknown_frames_detail(frames)
    assert "Anomalous frame" in detail
    assert "address mismatch" in detail


def test_no_anomalies_gives_explicit_boring_message():
    frames = [_write(0x1000000, ok=True)]
    report = build_report(frames, source_name="test.pcapng")
    assert "No unknown frames anywhere" in report
