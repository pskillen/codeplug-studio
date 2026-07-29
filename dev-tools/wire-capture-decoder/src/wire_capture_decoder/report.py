"""Render decoded frames into the report shape the capture brief asks for.

See tmp/anytone-airband/d890-cps-wire-capture-brief.md section 6
("What to hand back") for the deliverable this mirrors.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from .model import ProtocolFrame

QUIRK_ADDRESS = 0x02FA0010
CONTEXT_FRAMES = 5  # frames of context on each side of an unknown frame


def _shape_label(f: ProtocolFrame) -> str:
    if f.kind in ("WRITE_CMD",):
        return f"write, {f.fields.get('length', '?')}-byte payload"
    if f.kind in ("READ_CMD",):
        return f"read request, len={f.fields.get('length', '?'):#04x}"
    if f.kind in ("READ_REPLY",):
        return f"read reply, {f.fields.get('length', '?')}-byte payload"
    if f.kind in ("WRITE_ACK",):
        return "bare ACK"
    if f.kind == "MISSING_RADIO_REPLY":
        return "missing — capture ended before this reply"
    if f.kind in ("PROGRAM", "END", "IDENT_PROBE", "PROGRAM_REPLY", "IDENT_REPLY"):
        return "session control"
    if f.is_unknown():
        return f"UNKNOWN, {f.length} bytes"
    return f"{f.length} bytes"


def frame_inventory(frames: list[ProtocolFrame]) -> str:
    """Group by (direction, kind) only — addresses vary per frame and would
    otherwise blow this table up to one row per distinct address."""
    counts: Counter[tuple[str, str]] = Counter()
    reps: dict[tuple[str, str], ProtocolFrame] = {}
    anomaly_counts: Counter[tuple[str, str]] = Counter()
    for f in frames:
        key = (f.direction, f.kind)
        counts[key] += 1
        reps.setdefault(key, f)
        if f.checksum_ok is False or (f.note and not f.is_unknown()):
            anomaly_counts[key] += 1

    lines = ["| Direction | Kind | First bytes | Shape | Count | Anomalous |", "| --- | --- | --- | --- | --- | --- |"]
    for key, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        f = reps[key]
        direction, kind = key
        marker = "**unknown**" if f.is_unknown() else kind
        anomalies = anomaly_counts.get(key, 0)
        anomaly_cell = f"{anomalies}" if anomalies else ""
        lines.append(
            f"| {direction} | {marker} | `{f.raw[:4].hex(' ')}` | {_shape_label(f)} | {count} | {anomaly_cell} |"
        )
    return "\n".join(lines)


def _is_notable(f: ProtocolFrame) -> bool:
    """Unknown frames, plus otherwise-matched frames that still failed a
    checksum or carry a mismatch note (e.g. a READ_REPLY whose address/len
    didn't match what was requested) — those must not hide behind a
    "known" kind label."""
    return f.is_unknown() or f.kind == "TRAILING_RADIO" or f.checksum_ok is False or bool(f.note)


def unknown_frames_detail(frames: list[ProtocolFrame]) -> str:
    unknown_idxs = [i for i, f in enumerate(frames) if _is_notable(f)]
    if not unknown_idxs:
        return (
            "No unknown frames anywhere in this capture. Every frame decoded as "
            "PROGRAM / 0x02 / R / W / END / bare ACK. Per the brief's success "
            "criterion, that means the missing commit/swap/erase behavior is not "
            "an unknown command in this session — look at timing, ordering, or "
            "address choice instead."
        )

    blocks = []
    for i in unknown_idxs:
        f = frames[i]
        lo = max(0, i - CONTEXT_FRAMES)
        hi = min(len(frames), i + CONTEXT_FRAMES + 1)
        ctx_lines = []
        for j in range(lo, hi):
            g = frames[j]
            marker = ">>> " if j == i else "    "
            note = f"  [{g.note}]" if g.note else ""
            ctx_lines.append(
                f"{marker}[{j}] {g.direction:<12} {g.kind:<14} off={g.offset:<8} "
                f"len={g.length:<5} frames={g.frame_numbers} {g.raw.hex(' ')}{note}"
            )
        label = "Unknown" if f.is_unknown() or f.kind == "TRAILING_RADIO" else "Anomalous"
        blocks.append(
            f"### {label} frame #{i}\n\n"
            f"- direction: {f.direction}\n"
            f"- stream byte offset: {f.offset}\n"
            f"- length: {f.length}\n"
            f"- tshark frame number(s): {f.frame_numbers}\n"
            f"- time range: {f.time_range}\n"
            f"- note: {f.note or '(none)'}\n"
            f"- hex: `{f.raw.hex(' ')}`\n\n"
            "Context (5 frames before/after):\n\n"
            "```\n" + "\n".join(ctx_lines) + "\n```"
        )
    return "\n\n".join(blocks)


def session_boundaries(frames: list[ProtocolFrame]) -> str:
    first_write = next((i for i, f in enumerate(frames) if f.kind == "WRITE_CMD"), None)
    last_write = next(
        (i for i in range(len(frames) - 1, -1, -1) if frames[i].kind in ("WRITE_CMD", "WRITE_ACK")),
        None,
    )

    def render_span(lo: int, hi: int) -> str:
        lines = []
        for j in range(lo, hi):
            g = frames[j]
            note = f"  [{g.note}]" if g.note else ""
            lines.append(
                f"[{j}] {g.direction:<12} {g.kind:<14} off={g.offset:<8} "
                f"len={g.length:<5} {g.raw.hex(' ')}{note}"
            )
        return "\n".join(lines) if lines else "(empty)"

    parts = []
    if first_write is None:
        parts.append("No WRITE_CMD frame found in this capture (read-only session?).")
    else:
        parts.append(
            f"**Session opening** — from stream start to the first W frame (frame index "
            f"{first_write}):\n\n```\n{render_span(0, first_write)}\n```"
        )
    if last_write is None:
        parts.append("No WRITE_CMD/WRITE_ACK frame found for a closing span.")
    else:
        parts.append(
            f"**Session closing** — from the last W/ACK frame (index {last_write}) to stream end:\n\n"
            f"```\n{render_span(last_write, len(frames))}\n```"
        )
    return "\n\n".join(parts)


def quirk_address_check(frames: list[ProtocolFrame]) -> str:
    hits = [f for f in frames if f.kind == "WRITE_CMD" and f.fields.get("address") == QUIRK_ADDRESS]
    if not hits:
        return f"Address {QUIRK_ADDRESS:#010x} is never written in this capture (matches known quirk)."
    lines = [f"Address {QUIRK_ADDRESS:#010x} IS written in this capture — {len(hits)} time(s):"]
    for f in hits:
        lines.append(f"- offset {f.offset}, frames {f.frame_numbers}, data `{f.fields['data']}`")
    return "\n".join(lines)


def reads_during_write_phase(frames: list[ProtocolFrame]) -> str:
    first_write = next((i for i, f in enumerate(frames) if f.kind == "WRITE_CMD"), None)
    last_write = next(
        (i for i in range(len(frames) - 1, -1, -1) if frames[i].kind in ("WRITE_CMD", "WRITE_ACK")),
        None,
    )
    if first_write is None or last_write is None:
        return "N/A — no write phase in this capture."

    hits = []
    for i in range(first_write, last_write + 1):
        f = frames[i]
        if f.kind != "READ_CMD":
            continue
        reply = frames[i + 1] if i + 1 < len(frames) else None
        reply_desc = (
            f"{reply.kind} `{reply.raw.hex(' ')}`" if reply is not None else "(no reply captured)"
        )
        hits.append(
            f"- [{i}] READ_CMD addr={f.fields['address']:#010x} len={f.fields['length']:#04x} "
            f"-> {reply_desc}"
        )
    if not hits:
        return "No reads (0x52) were issued between the first and last write in this capture."
    return "\n".join(hits)


def build_report(frames: list[ProtocolFrame], *, source_name: str) -> str:
    sections = [
        f"# Wire capture decode report — {source_name}",
        "",
        f"Total decoded frames: {len(frames)}",
        "",
        "## 1. Frame inventory",
        "",
        frame_inventory(frames),
        "",
        "## 2. Unknown / anomalous frames (full detail)",
        "",
        unknown_frames_detail(frames),
        "",
        "## 3. Session opening/closing sequences",
        "",
        session_boundaries(frames),
        "",
        f"## 4. Is address {QUIRK_ADDRESS:#010x} ever written?",
        "",
        quirk_address_check(frames),
        "",
        "## 5. Reads issued during the write phase",
        "",
        reads_during_write_phase(frames),
        "",
    ]
    return "\n".join(sections)
