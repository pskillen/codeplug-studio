import type { FirmwareKind, RadioClass } from '@core/radio-targets/index.ts';
import { Pill } from '../v2/index.ts';

const FIRMWARE_KIND_LABEL: Record<FirmwareKind, string> = {
  stock: 'Stock',
  mod: 'Mod',
  open: 'Open',
};

/** Pill for how a firmware relates to the factory image: Stock / Mod / Open. */
export function FirmwareKindPill({ kind }: { kind: FirmwareKind }) {
  const tone = kind === 'mod' ? 'accent' : kind === 'open' ? 'success' : 'neutral';
  return <Pill tone={tone}>{FIRMWARE_KIND_LABEL[kind]}</Pill>;
}

/** DMR / FM class tag using the design-system mode colours. */
export function RadioClassPill({ radioClass }: { radioClass: RadioClass }) {
  return radioClass === 'dmr' ? (
    <Pill tone="semantic" color="var(--dsv2-mode-dmr)" textColor="var(--dsv2-pill-text-light)">
      DMR
    </Pill>
  ) : (
    <Pill tone="semantic" color="var(--dsv2-mode-fm)">
      FM
    </Pill>
  );
}
