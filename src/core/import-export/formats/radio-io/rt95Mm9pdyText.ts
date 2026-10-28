/**
 * RT95 MM9PDY text boundary: the radio's head draws printable ASCII only, so radio names, zone
 * names and channel descriptions are folded to it here, at the export edge. The library keeps
 * the operator's original text.
 */

import type { Channel } from '@core/models/library.ts';
import { RT95_LIMITS } from '@core/radios/retevis/rt95/limits.ts';
import { shortenWireName } from '@core/import-export/channelExpansion/shortenName.ts';

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * NFD-fold and strip combining marks, then replace anything outside 0x20-0x7E with `-`.
 * With `forbidUnderscore`, `_` also becomes `-` (the radio's 12-px font draws `_` blank).
 */
export function toRt95Ascii(
  text: string,
  opts: { forbidUnderscore: boolean },
): { text: string; replaced: boolean } {
  const folded = text.normalize('NFD').replace(COMBINING_MARKS, '');
  let out = '';
  for (const ch of folded) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 || c > 0x7e || (opts.forbidUnderscore && ch === '_')) out += '-';
    else out += ch;
  }
  return { text: out, replaced: out !== text };
}

export interface Rt95ChannelDescription {
  text: string;
  /** The source was longer than the description limit and was shortened. */
  shortened: boolean;
  /** At least one character was replaced by `-`. */
  replaced: boolean;
}

/**
 * Description for one channel. Source is `overrideText` when the build override sets one (an
 * explicit `''` means "no description"), else the channel Name. Sanitised (no `_`), shortened to
 * the description limit (channel abbreviation first), and left empty when it equals the radio name.
 */
export function rt95Mm9pdyChannelDescription(
  channel: Pick<Channel, 'name'> & Partial<Pick<Channel, 'abbreviation'>>,
  radioName: string,
  overrideText?: string,
): Rt95ChannelDescription {
  const fromOverride = overrideText !== undefined;
  const source = (fromOverride ? overrideText : channel.name).trim();
  if (source === '') return { text: '', shortened: false, replaced: false };

  const { text: clean, replaced } = toRt95Ascii(source, { forbidUnderscore: true });
  const limit = RT95_LIMITS.DESCRIPTION_LENGTH;
  const abbreviation = channel.abbreviation?.trim();
  const shortenedText = shortenWireName(clean, limit, {
    ...(!fromOverride && abbreviation
      ? {
          recomposeWithChannelAbbreviation: () =>
            toRt95Ascii(abbreviation, { forbidUnderscore: true }).text,
        }
      : {}),
  });
  const text = shortenedText.length > limit ? shortenedText.slice(0, limit) : shortenedText;
  const trimmed = text.trim();
  if (trimmed === radioName.trim()) return { text: '', shortened: false, replaced };
  return { text: trimmed, shortened: clean.length > limit, replaced };
}
