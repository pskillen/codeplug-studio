import type { ChannelTone } from '@core/models/libraryTypes.ts';
import type { RadioTone } from '@integrations/radio-io/radioChannelDto.ts';

/** Map library `ChannelTone` (`none` | CTCSS Hz | `D023N`) → radio-boundary `RadioTone`. */
export function channelToneToRadioTone(tone: ChannelTone | undefined): RadioTone {
  if (!tone || tone === 'none') return { kind: 'none' };
  const s = tone.trim();
  if (!s || s === '—' || s.toLowerCase() === 'none') return { kind: 'none' };

  const dcs = /^D(\d{1,3})([NPI]?)$/i.exec(s);
  if (dcs) {
    const code = Number.parseInt(dcs[1]!, 10);
    const suffix = dcs[2]?.toUpperCase() ?? '';
    const polarity = suffix === 'P' || suffix === 'I' ? 'I' : 'N';
    return { kind: 'dcs', code, polarity };
  }

  const hz = Number.parseFloat(s);
  if (Number.isFinite(hz) && hz > 0) {
    return { kind: 'ctcss', hz };
  }

  return { kind: 'none' };
}
