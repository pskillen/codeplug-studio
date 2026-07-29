"""Shared data model for stream chunks and decoded protocol frames."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Chunk:
    """One USBCOM payload as reported by tshark for a single direction."""

    frame_number: int
    time: float
    data: bytes


@dataclass(frozen=True)
class ChunkSpan:
    """Where a Chunk's bytes landed in the concatenated per-direction stream."""

    start: int
    end: int
    frame_number: int
    time: float


@dataclass
class Stream:
    """A continuous byte stream reassembled from many USB bulk transfers.

    USBPcap/USB splits protocol frames across multiple bulk transfers
    (max packet size), so protocol framing must be done on the
    concatenated stream, not per-USB-packet. `spans` lets us map any
    byte offset in `data` back to the tshark frame(s) it came from.
    """

    data: bytes
    spans: list[ChunkSpan]

    @classmethod
    def from_chunks(cls, chunks: list[Chunk]) -> Stream:
        buf = bytearray()
        spans: list[ChunkSpan] = []
        for c in chunks:
            start = len(buf)
            buf.extend(c.data)
            spans.append(ChunkSpan(start, len(buf), c.frame_number, c.time))
        return cls(bytes(buf), spans)

    def __len__(self) -> int:
        return len(self.data)

    def frame_numbers_in(self, start: int, end: int) -> list[int]:
        """tshark frame numbers whose bytes overlap [start, end)."""
        out = []
        for span in self.spans:
            if span.start < end and span.end > start:
                out.append(span.frame_number)
        return out

    def time_range_in(self, start: int, end: int) -> tuple[float | None, float | None]:
        nums = [
            span.time for span in self.spans if span.start < end and span.end > start
        ]
        if not nums:
            return (None, None)
        return (min(nums), max(nums))


Direction = str  # 'host->radio' | 'radio->host'

HOST_TO_RADIO: Direction = "host->radio"
RADIO_TO_HOST: Direction = "radio->host"


@dataclass
class ProtocolFrame:
    """One decoded protocol-level frame, anchored to its source stream offsets."""

    kind: str
    direction: Direction
    offset: int
    length: int
    raw: bytes
    fields: dict = field(default_factory=dict)
    checksum_ok: bool | None = None
    frame_numbers: list[int] = field(default_factory=list)
    time_range: tuple[float | None, float | None] = (None, None)
    note: str = ""

    @property
    def end(self) -> int:
        return self.offset + self.length

    @property
    def hex(self) -> str:
        return self.raw.hex()

    def is_unknown(self) -> bool:
        return self.kind.startswith("UNKNOWN")
