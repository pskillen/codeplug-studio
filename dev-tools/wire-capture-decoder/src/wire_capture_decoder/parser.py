"""Protocol-level framing for the AT-D890UV CPS wire protocol.

Two independent byte streams are reassembled (host->radio, radio->host).
Framing is done structurally, not from USB packet boundaries or by
scanning for 0x06 (see the capture brief's "pitfalls" section — both of
those are unreliable here).

The protocol is half-duplex request/response, so we walk the host
stream command-by-command and, for each command, consume the matching
number of bytes from the radio stream. Any byte range that doesn't fit
a known shape is emitted as an UNKNOWN_* frame instead of being
silently dropped or guessed at — those are exactly what this tool
exists to surface.
"""

from __future__ import annotations

from .model import (
    HOST_TO_RADIO,
    RADIO_TO_HOST,
    Chunk,
    ProtocolFrame,
    Stream,
)

ACK = 0x06
IDENT_PROBE_BYTE = 0x02
READ_OPCODE = 0x52  # 'R'
WRITE_OPCODE = 0x57  # 'W'
WRITE_LEN = 0x10  # writes are always exactly 16 bytes


def checksum8(body: bytes) -> int:
    """8-bit sum of body bytes, truncated to one byte."""
    return sum(body) & 0xFF


def build_streams(
    host_chunks: list[Chunk], radio_chunks: list[Chunk]
) -> tuple[Stream, Stream]:
    return Stream.from_chunks(host_chunks), Stream.from_chunks(radio_chunks)


def _finalize(stream: Stream, frame: ProtocolFrame) -> ProtocolFrame:
    frame.frame_numbers = stream.frame_numbers_in(frame.offset, frame.end)
    frame.time_range = stream.time_range_in(frame.offset, frame.end)
    return frame


# --- host-side command matchers -------------------------------------------


def try_match_host(data: bytes, off: int, *, require_checksum: bool = False) -> ProtocolFrame | None:
    """Try to match a known host command shape starting at `off`.

    `require_checksum` is used during resync scans, where we want a
    stronger signal than "the opcode byte happens to match" before
    treating a candidate offset as the real resync point.
    """
    n = len(data)
    if off >= n:
        return None

    if data[off:off + 7] == b"PROGRAM":
        return ProtocolFrame("PROGRAM", HOST_TO_RADIO, off, 7, data[off:off + 7])

    if data[off:off + 3] == b"END":
        return ProtocolFrame("END", HOST_TO_RADIO, off, 3, data[off:off + 3])

    b0 = data[off]

    if b0 == WRITE_OPCODE:
        # 24 bytes: opcode(1) + addr(4) + len(1) + data(16) + checksum(1) +
        # a fixed 0x06 terminator baked into the same frame/USB transfer.
        # (Mirrors the read-reply shape, which is also 'W' + ... + checksum
        # + 0x06 — the brief's "host: ... CC 06" line is this, not a
        # separately timed ACK. The radio's own bare-0x06 WRITE_ACK is a
        # second, later byte on top of this.)
        if off + 24 > n:
            return None  # truncated at end of capture
        if data[off + 5] != WRITE_LEN:
            return None
        raw = data[off:off + 24]
        addr = int.from_bytes(raw[1:5], "big")
        payload = raw[6:22]
        cksum_byte = raw[22]
        terminator = raw[23]
        calc = checksum8(raw[1:22])
        ok = calc == cksum_byte
        if require_checksum and not (ok and terminator == ACK):
            return None
        note = "" if terminator == ACK else f"trailing byte {terminator:#04x} != 0x06 terminator"
        return ProtocolFrame(
            "WRITE_CMD",
            HOST_TO_RADIO,
            off,
            24,
            raw,
            fields={"address": addr, "length": WRITE_LEN, "data": payload.hex()},
            checksum_ok=ok,
            note=note,
        )

    if b0 == READ_OPCODE:
        if off + 6 > n:
            return None
        raw = data[off:off + 6]
        addr = int.from_bytes(raw[1:5], "big")
        length = raw[5]
        if require_checksum and length > 0xF0:
            # Sanity bound from the brief ("up to 0xF0 observed"). Only
            # applied during resync, where false positives matter more
            # than during normal in-line parsing.
            return None
        return ProtocolFrame(
            "READ_CMD", HOST_TO_RADIO, off, 6, raw, fields={"address": addr, "length": length}
        )

    if b0 == IDENT_PROBE_BYTE and not require_checksum:
        return ProtocolFrame("IDENT_PROBE", HOST_TO_RADIO, off, 1, data[off:off + 1])

    return None


def find_host_resync(data: bytes, start: int) -> int:
    n = len(data)
    for off in range(start, n):
        if try_match_host(data, off, require_checksum=True) is not None:
            return off
    return n


# --- radio-side reply matchers ---------------------------------------------


def match_program_reply(data: bytes, off: int) -> ProtocolFrame | None:
    n = len(data)
    if data[off:off + 3] == b"QX\x06":
        return ProtocolFrame("PROGRAM_REPLY", RADIO_TO_HOST, off, 3, data[off:off + 3])
    if off < n and data[off] == 0x00:
        return ProtocolFrame(
            "PROGRAM_REPLY",
            RADIO_TO_HOST,
            off,
            1,
            data[off:off + 1],
            note="quirk variant: lone 0x00 instead of QX\\x06",
        )
    return None


def match_ident_reply(data: bytes, off: int) -> ProtocolFrame | None:
    n = len(data)
    idx = off
    while idx < n and data[idx] != ACK:
        idx += 1
    if idx >= n:
        return None  # never terminated within available bytes
    length = idx - off + 1
    raw = data[off:off + length]
    fields: dict = {}
    if length >= 8:
        fields["model"] = raw[0:8].split(b"\x00")[0].decode("ascii", errors="replace")
    if length >= 13:
        fields["version"] = raw[9:13].decode("ascii", errors="replace")
    return ProtocolFrame("IDENT_REPLY", RADIO_TO_HOST, off, length, raw, fields=fields)


def match_read_reply(data: bytes, off: int, req_addr: int, req_len: int) -> ProtocolFrame | None:
    n = len(data)
    if off >= n or data[off] != WRITE_OPCODE:
        return None
    if off + 6 > n:
        return None
    actual_len = data[off + 5]
    total = actual_len + 8
    if off + total > n:
        return None  # incomplete — let the caller treat as not-yet-matchable
    raw = data[off:off + total]
    addr = int.from_bytes(raw[1:5], "big")
    payload = raw[6:6 + actual_len]
    cksum_byte = raw[6 + actual_len]
    ack_byte = raw[7 + actual_len]
    calc = checksum8(raw[1:6 + actual_len])
    checksum_ok = calc == cksum_byte

    notes = []
    if addr != req_addr:
        notes.append(f"address mismatch: requested {req_addr:#010x}, replied {addr:#010x}")
    if actual_len != req_len:
        notes.append(f"length mismatch: requested {req_len:#04x}, replied {actual_len:#04x}")
    if not checksum_ok:
        notes.append("checksum mismatch")
    if ack_byte != ACK:
        notes.append(f"trailing byte {ack_byte:#04x} != 0x06 ACK")

    return ProtocolFrame(
        "READ_REPLY",
        RADIO_TO_HOST,
        off,
        total,
        raw,
        fields={"address": addr, "length": actual_len, "data": payload.hex()},
        checksum_ok=checksum_ok,
        note="; ".join(notes),
    )


def match_write_ack(data: bytes, off: int) -> ProtocolFrame | None:
    if off < len(data) and data[off] == ACK:
        return ProtocolFrame("WRITE_ACK", RADIO_TO_HOST, off, 1, data[off:off + 1])
    return None


def radio_resync_to_ack(data: bytes, off: int) -> int:
    """Best-effort resync: consume up to and including the next bare 0x06.

    Used when an expected radio reply doesn't match at the current
    offset — e.g. an unforeseen frame was inserted before the ACK we
    expected. This is a heuristic, not a guarantee; the resulting
    UNKNOWN_RADIO frame is exactly the thing a human should look at.
    """
    n = len(data)
    idx = off
    while idx < n and data[idx] != ACK:
        idx += 1
    return min(idx + 1, n)


# --- correlator --------------------------------------------------------


def correlate(host: Stream, radio: Stream) -> list[ProtocolFrame]:
    frames: list[ProtocolFrame] = []
    h = host.data
    r = radio.data
    hoff = 0
    roff = 0

    def emit(stream: Stream, frame: ProtocolFrame) -> None:
        frames.append(_finalize(stream, frame))

    def consume_radio_reply(expected_kind: str, matcher) -> None:
        nonlocal roff
        result = matcher(r, roff)
        if result is not None:
            emit(radio, result)
            roff = result.end
            return
        resync_end = radio_resync_to_ack(r, roff)
        if resync_end > roff:
            unk = ProtocolFrame(
                "UNKNOWN_RADIO",
                RADIO_TO_HOST,
                roff,
                resync_end - roff,
                r[roff:resync_end],
                note=f"expected {expected_kind} here but shape didn't match",
            )
            emit(radio, unk)
            roff = resync_end
        else:
            # No radio bytes left at all — don't drop this silently. Most
            # often this means the capture was stopped before the radio's
            # reply to the last command arrived, but it's exactly the kind
            # of thing that should be visible in the report either way.
            missing = ProtocolFrame(
                "MISSING_RADIO_REPLY",
                RADIO_TO_HOST,
                roff,
                0,
                b"",
                note=f"expected {expected_kind} but the radio stream ended first "
                "(capture likely stopped before the reply arrived)",
            )
            emit(radio, missing)

    while hoff < len(h):
        cmd = try_match_host(h, hoff)
        if cmd is None:
            resync = find_host_resync(h, hoff + 1)
            unk = ProtocolFrame(
                "UNKNOWN_HOST", HOST_TO_RADIO, hoff, resync - hoff, h[hoff:resync]
            )
            emit(host, unk)
            hoff = resync
            continue

        emit(host, cmd)
        hoff = cmd.end

        if cmd.kind == "PROGRAM":
            consume_radio_reply("PROGRAM_REPLY (QX\\x06)", match_program_reply)
        elif cmd.kind == "IDENT_PROBE":
            consume_radio_reply("IDENT_REPLY (terminated by 0x06)", match_ident_reply)
        elif cmd.kind == "END":
            pass  # best-effort, no reply required
        elif cmd.kind == "READ_CMD":
            addr = cmd.fields["address"]
            length = cmd.fields["length"]
            consume_radio_reply(
                f"READ_REPLY for addr {addr:#010x} len {length:#04x}",
                lambda data, off, a=addr, l=length: match_read_reply(data, off, a, l),
            )
        elif cmd.kind == "WRITE_CMD":
            consume_radio_reply("WRITE_ACK (bare 0x06)", match_write_ack)

    if roff < len(r):
        trailing = ProtocolFrame(
            "TRAILING_RADIO",
            RADIO_TO_HOST,
            roff,
            len(r) - roff,
            r[roff:],
            note="unconsumed radio bytes after the last host command in the stream",
        )
        emit(radio, trailing)

    # Deliberately left in construction order (each host command immediately
    # followed by its radio reply/replies), not re-sorted by wall-clock time.
    # USB timing jitter can otherwise interleave frames in a way that hides
    # the command/reply pairing the report depends on.
    return frames


def decode_frames(host_chunks: list[Chunk], radio_chunks: list[Chunk]) -> tuple[list[ProtocolFrame], Stream, Stream]:
    host, radio = build_streams(host_chunks, radio_chunks)
    frames = correlate(host, radio)
    return frames, host, radio
