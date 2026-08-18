"""Base protocol interface for read-only dumps."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol as TypingProtocol


class BytePipe(TypingProtocol):
    def write(self, data: bytes) -> None: ...
    def read_exact(self, nbytes: int, timeout_ms: int) -> bytes: ...
    def flush(self) -> None: ...


@dataclass(frozen=True)
class FirmwareIdent:
    struct_version: int
    radio_type: int
    fw_revision: str
    build_date: str
    features: int


@dataclass(frozen=True)
class RegionSpec:
    mem: int
    mem_label: str
    addr: int
    length: int


class ReadOnlyProtocol(ABC):
    """Protocol plugin surface — read and command ACK only."""

    name: str
    default_baud: int

    @abstractmethod
    def ident(self, pipe: BytePipe) -> FirmwareIdent: ...

    @abstractmethod
    def show_cps(self, pipe: BytePipe) -> None: ...

    @abstractmethod
    def close_cps(self, pipe: BytePipe) -> None: ...

    @abstractmethod
    def read_region(self, pipe: BytePipe, mem: int, addr: int, length: int) -> bytes: ...
