# RadioModelPills

Small tags for the radio catalog hierarchy (manufacturer → model → firmware). Used by the New build picker and the Export for radio list; reusable for the landing-page support matrix.

| Export              | Props                       | Output                                                                       |
| ------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `FirmwareKindPill`  | `kind: FirmwareKind`        | `Stock` (neutral), `Mod` (accent), `Open` (success)                          |
| `FirmwareLabelPill` | `firmware: FirmwareVariant` | The firmware's own label (e.g. `MM9PDY`), toned by kind, kind in the tooltip |
| `RadioClassPill`    | `radioClass: RadioClass`    | `DMR` (mode DMR colour), `FM` (mode FM colour)                               |

Types come from `@core/radio-targets` (`FirmwareKind`, `RadioClass`); both render the v2 `Pill`.
