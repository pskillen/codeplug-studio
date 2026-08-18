"""Protocol plugin registry."""

from __future__ import annotations

from .base import ReadOnlyProtocol
from .opengd77.protocol import OpenGd77Protocol

_PROTOCOLS: dict[str, ReadOnlyProtocol] = {
    "opengd77": OpenGd77Protocol(),
}


def get_protocol(name: str) -> ReadOnlyProtocol:
    key = name.strip().lower()
    if key not in _PROTOCOLS:
        known = ", ".join(sorted(_PROTOCOLS))
        raise ValueError(f"Unknown protocol '{name}' (known: {known})")
    return _PROTOCOLS[key]


def protocol_names() -> list[str]:
    return sorted(_PROTOCOLS)
