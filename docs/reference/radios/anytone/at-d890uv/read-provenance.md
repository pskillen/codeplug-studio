# AT-D890UV read provenance sidecar

Codeplug Studio's debug capture writes `debug/read-provenance.json` into each AT-D890UV radio-backup archive. It records how each stored range was acquired, for the comparison view in the [radio debug feature](../../../../features/radio-debug/README.md). It is an archive claim, never live evidence of which physical unit answered.

## Shape

```json
{
  "version": 1,
  "ranges": [
    {
      "regionId": "...",
      "address": 0,
      "byteLength": 0,
      "kind": "sparse | vital",
      "requestedUnit": null,
      "respondingUnit": null,
      "bothReadsMatched": null
    }
  ]
}
```

| Field                               | Meaning                                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regionId`, `address`, `byteLength` | Must equal the manifest region and the stored byte length. One range per region.                                                                                        |
| `kind`                              | `sparse` for sparse configuration (`sparse-<hex address>`), `vital` for a whole 256 KiB vital unit (`vital-<unit id>`).                                                 |
| `requestedUnit`                     | Vital unit id the read requested (address from the vital unit table); `null` for sparse.                                                                                |
| `respondingUnit`                    | Explicit observed responding unit, or `null` (Unknown). Current captures always write `null`. Only a vital range may carry one, and it must name a known vital unit id. |
| `bothReadsMatched`                  | Vital units are read twice; a capture only succeeds when both passes match, so `true`. `null` for sparse.                                                               |

## Validation

The sidecar is refused whole when the version is not 1, the range count differs from the manifest regions, a range is duplicated or does not match its region, a kind or unit contradicts its region id or address, a sparse range claims a unit, a vital range lacks a matching `debug/vital.json`, or any field has the wrong type. A refused sidecar leaves byte comparison unavailable and never makes the bytes trusted.

## Limits

- The requested address is echoed by reply validation; that does not establish physical flash identity. The tune B request is known to be answered with other bytes (as returned).
- Equal bytes, serials, labels or repeated-read agreement never establish a responding unit, and never validate calibration.
- A comparison verdict is Same or Different only when both archives explicitly name a responding unit; otherwise Unknown.
- The history ZIP preserves the sidecar byte for byte.
