/** Satellite keps to any radio running RadioFoundry, over the debug link (docs/reference/radios/radiofoundry/satellite-keps.md). */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/index.ts';
import { isRadioFoundryCableRadio } from '@integrations/radio-io/radios/radiofoundry/protocol.ts';
import {
  countRadioFoundryWriteSatellites,
  packRadioFoundrySatellites,
  radioFoundrySkippedSatellites,
  radioFoundrySkippedTransmitters,
} from '@integrations/radio-io/radios/radiofoundry/satelliteCodec.ts';
import {
  formatRadioFoundrySatelliteFrames,
  type RadioFoundrySatelliteFrame,
  RadioFoundrySatellitesUnavailableError,
  writeRadioFoundrySatellites,
} from '@integrations/radio-io/radios/radiofoundry/satelliteWrite.ts';
import type { SatelliteKepsWriteResult } from './satelliteKepsWriteAdapters.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';

export async function writeRadioFoundrySatellitesToRadio(
  session: RadioSession,
  satellites: readonly Satellite[],
  opts?: {
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    satelliteOverrides?: readonly BuildEntityOverride[];
  },
): Promise<SatelliteKepsWriteResult> {
  if (!isRadioFoundryCableRadio(session.radio)) {
    throw new Error('RadioFoundry satellite write needs a RadioFoundry radio session.');
  }

  const options = {
    bands: session.radio.board.limits.BANDS_HZ,
    satelliteOverrides: opts?.satelliteOverrides,
  };
  const selected = countRadioFoundryWriteSatellites(satellites, options);
  const max = RADIOFOUNDRY_LIMITS.SATELLITE_MAX;
  const radioLabel = session.descriptor.label;

  if (selected > max) {
    throw new RadioWriteBlockedError(
      `You have selected ${selected} satellites, but the ${radioLabel} holds ${max} (see docs/reference/radios/radiofoundry/satellite-keps.md). Please deselect some satellites in the library.`,
      { selected, max, radioLabel },
    );
  }
  if (selected === 0) {
    throw new RadioWriteBlockedError(
      `No satellite in the library can go to the ${radioLabel}: RadioFoundry needs an FM uplink and downlink in this radio’s bands. The radio’s satellites are unchanged.`,
    );
  }

  const frames: RadioFoundrySatelliteFrame[] = [];
  let debugText: string;
  try {
    const done = await writeRadioFoundrySatellites(
      session.radio,
      packRadioFoundrySatellites(satellites, options),
      {
        onProgress: opts?.onProgress,
        signal: opts?.signal,
        frameLog: frames,
      },
    );
    debugText = [
      `Satellite keps written: ${done.written} records sent, ${done.written} installed on the radio (capacity ${done.capacity}), read-back matched.`,
      `SATELLITE frames (${frames.length}):`,
      ...formatRadioFoundrySatelliteFrames(frames),
    ].join('\n');
    console.info('[radiofoundry-keps]', debugText);
  } catch (err) {
    if (err instanceof RadioFoundrySatellitesUnavailableError) {
      throw new RadioWriteBlockedError(`${err.message} Nothing was written.`);
    }
    throw err;
  }

  return {
    written: selected,
    readBack: 'matched',
    debugText,
    skipped: radioFoundrySkippedSatellites(satellites, options),
    skippedTransmitters: radioFoundrySkippedTransmitters(satellites, options),
  };
}
