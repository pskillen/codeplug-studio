# Dead ends

Killed hypotheses, and what killed each. Append-only.

---

| #   | Hypothesis                                                                                         | Killed by                  | Why                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| X2  | qDMR `ScanListElement` revert/member index encoding (`idx+1`, revert at `0x0f`) is the serial bug. | `S/2026-08-15-qdmr`        | Virtual image, not metadata `0x11`. Studio/NeonPlug serial already match each other on `ch−2` designated TX.  |
| X3  | Studio serial never sets designated-TX mode, so carriers cannot bind.                              | `S/2026-08-15-studio-scan` | Encode sets scan TX mode 2 when `designatedTxChannel > 0`. NeonPlug JSON often leaves mode 0.                 |
| X4  | APRS `16225539` cannot be an endian swap of `234999` (`S/2026-08-15-ids` used hex `0x039477`).     | `D/2026-08-15-after`       | Correct `234999` is `0x0395F7`. Bytes `03 95 f7` BE=234999, LE=`16225539`. Hypothesis restored as finding A6. |
| X5  | Persistent red circle on LCD is TX-forbid (`0x18` bit 3) or GPS no-fix.                            | `O/operator-2026-08-16`    | Operator confirmed **auto power off** (`settings 0x1E`); disabling clears the icon. TX works throughout.        |
| X6  | Persistent red circle is GPS unsuccessful positioning (manual §7.9.1).                             | `O/operator-2026-08-16`    | Same icon; auto power off was the actual cause.                                                                 |
