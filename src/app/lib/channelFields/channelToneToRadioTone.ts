import { parseChannelTone } from '@core/domain/tones.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import type { RadioTone } from '@integrations/radio-io/radioChannelDto.ts';

/** Map library `ChannelTone` (`none` | CTCSS Hz | `D023N` | `D023I`) → radio-boundary `RadioTone`. */
export function channelToneToRadioTone(tone: ChannelTone | undefined): RadioTone {
  if (!tone || tone === 'none') return { kind: 'none' };
  const s = tone.trim();
  if (!s || s === '—' || s.toLowerCase() === 'none') return { kind: 'none' };

  const parsed = parseChannelTone(s);
  if (parsed.kind === 'dcs') return { kind: 'dcs', code: parsed.code, polarity: parsed.polarity };
  if (parsed.kind === 'ctcss') return { kind: 'ctcss', hz: parsed.hz };
  return { kind: 'none' };
}
