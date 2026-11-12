/**
 * Hardware model + firmware variant catalog (#1493).
 *
 * Vendor-neutral metadata that groups {@link RadioTarget}s by manufacturer, model
 * and firmware. A radio target is one `(model, firmware)` pair that Codeplug Studio
 * can export for; a model may also list firmware (e.g. stock) with no target yet so
 * pickers and support matrices can show it as "not supported".
 */

/** How a firmware relates to the radio's factory image. */
export type FirmwareKind = 'stock' | 'mod' | 'open';

/** Firmware that runs on a hardware model. */
export interface FirmwareVariant {
  /** Stable id, unique within the model (`stock`, `mm9pdy`, `radiofoundry`, `opengd77`). */
  id: string;
  /** Display label ("Stock", "MM9PDY", "RadioFoundry", "OpenGD77"). */
  label: string;
  /** `stock` = factory image, `mod` = patched stock, `open` = complete rewrite. */
  kind: FirmwareKind;
}

export type RadioFormFactor = 'handheld' | 'mobile';

/** Coarse radio class — what the hardware can do, not the firmware. */
export type RadioClass = 'dmr' | 'fm';

export interface RadioModel {
  id: string;
  manufacturer: string;
  /** Model name without the manufacturer ("DM-32UV", "DM-1701 / RT-84"). */
  label: string;
  formFactor: RadioFormFactor;
  /** `dmr` = DMR plus analogue FM; `fm` = analogue only. */
  radioClass: RadioClass;
  /** Every firmware variant for this model in display order; stock first. */
  firmware: readonly FirmwareVariant[];
}

const STOCK: FirmwareVariant = { id: 'stock', label: 'Stock', kind: 'stock' };
const MM9PDY: FirmwareVariant = { id: 'mm9pdy', label: 'MM9PDY', kind: 'mod' };
const RADIOFOUNDRY: FirmwareVariant = { id: 'radiofoundry', label: 'RadioFoundry', kind: 'open' };
const OPENGD77: FirmwareVariant = { id: 'opengd77', label: 'OpenGD77', kind: 'open' };

/** Authoritative hardware model catalog. */
export const RADIO_MODELS: Record<string, RadioModel> = {
  'anytone-at-d890uv': {
    id: 'anytone-at-d890uv',
    manufacturer: 'Anytone',
    label: 'AT-D890UV',
    formFactor: 'mobile',
    radioClass: 'dmr',
    firmware: [STOCK, MM9PDY],
  },
  'baofeng-dm32uv': {
    id: 'baofeng-dm32uv',
    manufacturer: 'Baofeng',
    label: 'DM-32UV',
    formFactor: 'handheld',
    radioClass: 'dmr',
    firmware: [STOCK, MM9PDY, RADIOFOUNDRY],
  },
  'baofeng-dm1701': {
    id: 'baofeng-dm1701',
    manufacturer: 'Baofeng',
    label: 'DM-1701 / RT-84',
    formFactor: 'handheld',
    radioClass: 'dmr',
    firmware: [STOCK, OPENGD77],
  },
  'baofeng-uv5r-mini': {
    id: 'baofeng-uv5r-mini',
    manufacturer: 'Baofeng',
    label: 'UV-5R Mini',
    formFactor: 'handheld',
    radioClass: 'fm',
    firmware: [STOCK, MM9PDY],
  },
  'baofeng-uv21': {
    id: 'baofeng-uv21',
    manufacturer: 'Baofeng',
    label: 'UV-21Pro V2',
    formFactor: 'handheld',
    radioClass: 'fm',
    firmware: [STOCK],
  },
  'retevis-rt95': {
    id: 'retevis-rt95',
    manufacturer: 'Retevis',
    label: 'RT95 VOX',
    formFactor: 'mobile',
    radioClass: 'fm',
    firmware: [STOCK, MM9PDY],
  },
  'tyt-md9600': {
    id: 'tyt-md9600',
    manufacturer: 'TYT',
    label: 'MD-9600 / RT-90',
    formFactor: 'mobile',
    radioClass: 'dmr',
    firmware: [STOCK, OPENGD77],
  },
};

export function listRadioModels(): RadioModel[] {
  return Object.values(RADIO_MODELS);
}

export function radioModelFor(modelId: string): RadioModel | undefined {
  return RADIO_MODELS[modelId];
}

export function firmwareVariantFor(
  modelId: string,
  firmwareId: string,
): FirmwareVariant | undefined {
  return RADIO_MODELS[modelId]?.firmware.find((fw) => fw.id === firmwareId);
}

/** "Baofeng DM-32UV" */
export function radioModelDisplayLabel(model: RadioModel): string {
  return `${model.manufacturer} ${model.label}`;
}
