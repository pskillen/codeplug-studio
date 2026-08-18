"""Serial byte pipe for live hardware."""

from __future__ import annotations

import time

import serial
from serial.tools import list_ports


class SerialBytePipe:
    def __init__(self, port: str, baud: int, timeout_s: float = 5.0) -> None:
        self._ser = serial.Serial(port=port, baudrate=baud, timeout=timeout_s)

    def write(self, data: bytes) -> None:
        self._ser.write(data)

    def read_exact(self, nbytes: int, timeout_ms: int) -> bytes:
        deadline = time.monotonic() + (timeout_ms / 1000.0)
        buf = bytearray()
        while len(buf) < nbytes:
            if time.monotonic() > deadline:
                raise TimeoutError(f"Timed out reading {nbytes} bytes (got {len(buf)})")
            chunk = self._ser.read(nbytes - len(buf))
            if chunk:
                buf.extend(chunk)
        return bytes(buf)

    def flush(self) -> None:
        self._ser.reset_input_buffer()

    def close(self) -> None:
        self._ser.close()


def list_serial_ports() -> list[str]:
    return [port.device for port in list_ports.comports()]
