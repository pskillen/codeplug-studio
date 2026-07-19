# TxOffsetControls

Contributor sidecar for `TxOffsetControls.tsx` — TX offset display and quick buttons on channel Frequencies.

## Purpose

Shows the live RX/TX offset (`===` or `+/- MHz`) and band-appropriate quick buttons that set TX from RX + offset. Vendor-neutral; uses `src/core/domain/txOffsets.ts`.

## Props

| Prop                  | Type                            | Description                     |
| --------------------- | ------------------------------- | ------------------------------- |
| `rxFrequencyHz`       | `number \| null`                | Live RX frequency (Hz)          |
| `txFrequencyHz`       | `number \| null`                | Live TX frequency (Hz)          |
| `onTxFrequencyChange` | `(txMhzString: string) => void` | Sets TX form field (MHz string) |

## Usage

```tsx
<TxOffsetControls rxFrequencyHz={liveRxHz} txFrequencyHz={liveTxHz} onTxFrequencyChange={setTx} />
```

## Behaviour

- Hidden until RX is a valid finite Hz value.
- Buttons from `txOffsetsForFrequencyHz` (2 m / 70 cm documented; else Simplex only).
- Active button highlighted when current offset matches within epsilon.
- Click sets TX via `hzToMhzString(rxHz + offset)`.

## Related

- [tx-offsets.md](../../../docs/reference/tx-offsets.md)
- [library/README.md](../../../docs/features/library/README.md)
- [#156](https://github.com/pskillen/codeplug-studio/issues/156)
