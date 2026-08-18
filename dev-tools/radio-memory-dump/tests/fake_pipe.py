"""Fake byte pipe for unit tests."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FakeBytePipe:
    """Scripted response byte stream consumed by read_exact."""

    responses: list[bytes] = field(default_factory=list)
    written: list[bytes] = field(default_factory=list)
    _response_bytes: bytes = b""
    _read_offset: int = 0

    def __post_init__(self) -> None:
        if self.responses:
            self._response_bytes = b"".join(self.responses)

    def write(self, data: bytes) -> None:
        self.written.append(bytes(data))

    def read_exact(self, nbytes: int, timeout_ms: int) -> bytes:
        del timeout_ms
        end = self._read_offset + nbytes
        chunk = self._response_bytes[self._read_offset:end]
        if len(chunk) < nbytes:
            raise TimeoutError(
                f"No scripted response for read of {nbytes} bytes (got {len(chunk)})"
            )
        self._read_offset = end
        return chunk

    def flush(self) -> None:
        return None
