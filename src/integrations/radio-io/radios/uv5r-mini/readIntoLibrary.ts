import { UV5R_MINI_LIMITS } from '@core/radios/baofeng/uv-5r-mini/limits.ts';
import type { RadioLibraryRead } from '../../readIntoLibrary.ts';
import type { ProgressFn, RadioSession } from '../../types.ts';
import { uv5rMiniProfileIdForDetection } from './firmwareDetect.ts';
import { Uv5rMiniProtocol } from './protocol.ts';

export const UV5R_MINI_READ_DROPPED_FIELDS = [
  'DTMF signal code',
  'PTT ID mode',
  'Voice scramble',
  'RX DTMF (speaker opens only on DTMF plus tone)',
  'Busy channel lockout',
  'Frequency hopping',
  'Unnamed record bits',
] as const;

export function analogModeForMiniRx(rxHz: number): 'am' | 'fm' {
  return rxHz >= UV5R_MINI_LIMITS.AM_BAND_MIN_HZ && rxHz <= UV5R_MINI_LIMITS.AM_BAND_MAX_HZ
    ? 'am'
    : 'fm';
}

export async function readUv5rMiniIntoLibrary(
  session: RadioSession,
  opts: { onProgress?: ProgressFn; signal?: AbortSignal },
): Promise<RadioLibraryRead> {
  const radio = session.radio;
  if (!(radio instanceof Uv5rMiniProtocol)) throw new Error('Expected a UV-5R Mini protocol');
  const image = await radio.download(opts);
  const detection = await radio.detectFirmware({ signal: opts.signal });
  if (detection.kind === 'unsupported') throw new Error(detection.reason);
  const zoneRead = detection.kind === 'mm9pdy' ? await radio.readZones(opts) : undefined;
  const notes: string[] = [];
  if (zoneRead?.kind === 'none') {
    notes.push(
      'The radio reports MM9PDY firmware but has no readable zone table: no zones were read.',
    );
  } else if (zoneRead?.kind === 'zones') {
    if (!zoneRead.memberOrderFromRadio)
      notes.push(
        'This firmware does not report the order of channels inside zones, so they are listed by channel number.',
      );
    if (!zoneRead.scanSetsFromRadio)
      notes.push(
        "This firmware does not report per-zone scan sets, so the build's zone scan settings were left as they were.",
      );
  }
  return {
    modelLabel: session.descriptor.label,
    profileId: uv5rMiniProfileIdForDetection(detection)!,
    firmwareLabel: detection.kind === 'mm9pdy' ? 'MM9PDY modded firmware' : 'Stock firmware',
    channels: radio
      .decodeChannels(image)
      .filter((c) => !c.empty)
      .map((c) => ({ ...c, analogMode: analogModeForMiniRx(c.rxHz) })),
    zones: zoneRead?.kind === 'zones' ? zoneRead.zones : [],
    droppedFields: UV5R_MINI_READ_DROPPED_FIELDS,
    notes,
  };
}
