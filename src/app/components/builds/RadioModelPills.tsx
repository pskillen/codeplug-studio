import type { FirmwareKind, FirmwareVariant, RadioClass } from '@core/radio-targets/index.ts';
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

const FIRMWARE_KIND_TITLE: Record<FirmwareKind, string> = {
  stock: 'Factory firmware',
  mod: 'Modded stock firmware',
  open: 'Open firmware',
};

/** Pill carrying a firmware's own label (Stock, MM9PDY, OpenGD77…), toned by its kind. */
export function FirmwareLabelPill({ firmware }: { firmware: FirmwareVariant }) {
  const tone =
    firmware.kind === 'mod' ? 'accent' : firmware.kind === 'open' ? 'success' : 'neutral';
  return (
    <span title={FIRMWARE_KIND_TITLE[firmware.kind]}>
      <Pill tone={tone}>{firmware.label}</Pill>
    </span>
  );
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
