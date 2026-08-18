"""Manifest writer for dump output directory."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RegionRecord:
    mem: int
    mem_label: str
    addr: int
    length: int
    path: str


@dataclass
class DumpManifest:
    protocol: str
    port: str
    baud: int
    captured_at: str
    firmware: str | None = None
    radio_type: int | None = None
    regions: list[RegionRecord] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["regions"] = [asdict(r) for r in self.regions]
        return data

    def write(self, out_dir: Path) -> None:
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / "manifest.json"
        path.write_text(json.dumps(self.to_dict(), indent=2) + "\n", encoding="utf-8")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
