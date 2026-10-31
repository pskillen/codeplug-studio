/**
 * The parts of a Write (#1393, workflow design §2.2): one tick per part, one button label from the
 * ticks. Pure helpers shared by the part list, the Review step and the panel's service mapping.
 */

export interface WriteParts {
  codeplug: boolean;
  /** Digital contacts (dual-bank radios: DM-32, OpenGD77, AT-D890). */
  contacts: boolean;
  /** Radio settings (D890 and RT95 Web Serial). */
  settings: boolean;
  /** Satellite keps. */
  keps: boolean;
}

/** Defaults each time the stepper opens: codeplug ticked; the rest unticked. */
export const DEFAULT_WRITE_PARTS: WriteParts = {
  codeplug: true,
  contacts: false,
  settings: false,
  keps: false,
};

/** Which optional rows a radio offers. Rows a radio does not support are not shown. */
export interface WritePartSupport {
  contacts: boolean;
  keps: boolean;
  settings: boolean;
}

const PART_NOUN: readonly [keyof WriteParts, string][] = [
  ['codeplug', 'codeplug'],
  ['contacts', 'contacts'],
  ['settings', 'settings'],
  ['keps', 'keps'],
];

/** Number of ticked parts. */
export function tickedPartCount(parts: WriteParts): number {
  return PART_NOUN.filter(([key]) => parts[key]).length;
}

/**
 * Review's primary button: `Write codeplug`, `Write codeplug + contacts`, `Write 3 parts`.
 * Nothing ticked gives plain `Write` (the stepper never reaches Review in that state).
 */
export function writeButtonLabel(parts: WriteParts): string {
  const names = PART_NOUN.filter(([key]) => parts[key]).map(([, noun]) => noun);
  if (names.length === 0) return 'Write';
  if (names.length >= 3) return `Write ${names.length} parts`;
  return `Write ${names.join(' + ')}`;
}

/** Drop ticks for rows the radio does not offer. */
export function clampPartsToSupport(parts: WriteParts, support: WritePartSupport): WriteParts {
  return {
    codeplug: parts.codeplug,
    contacts: support.contacts && parts.contacts,
    settings: support.settings && parts.settings,
    keps: support.keps && parts.keps,
  };
}

/** Parts that go through one `uploadPreparedRadioWrite` session. */
export function writesToRadioImage(parts: WriteParts): boolean {
  return parts.codeplug || parts.contacts;
}
