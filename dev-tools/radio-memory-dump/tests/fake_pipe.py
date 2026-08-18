"""Fake byte pipe for unit tests."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FakeBytePipe:
    """Scripted request/response byte pipe."""

    responses: list[bytes] = field(default_factory=list)
    written: list[bytes] = field(default_factory=list)
    _response_offset: int = 0

    def write(self, data: bytes) -> None:
        self.written.append(bytes(data))

    def read_exact(self, nbytes: int, timeout_ms: int) -> bytes:
        del timeout_ms
        if self._response_offset >= len(self.responses):
            raise TimeoutError(f"No scripted response for read of {nbytes} bytes")
        chunk = self.responses[self._response_offset]
        self._response_offset += 1
        if len(chunk) != nbytes:
            raise ValueError(f"Scripted response length {len(chunk)} != expected {nbytes}")
        return chunk

    def flush(self) -> None:
        return None
