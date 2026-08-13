import { describe, expect, it } from 'vitest';
import {
  OPENGD77_TYPE_COMMAND,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import { OPENGD77_CMD_CONTROL, OPENGD77_CONTROL_SAVE_REBOOT, OPENUV380_OFFSET } from './constants.ts';
import { OpenGd77Protocol } from './protocol.ts';
import { packSatelliteBank } from './satelliteCodec.ts';
import { uploadOpenGd77SatelliteBank } from './satelliteWrite.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

function makeTransmitter(): SatelliteTransmitter {
  return {
    id: 'tx-1',
    label: 'FM Voice',
    mode: 'FM',
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
    uplinkToneHz: null,
    downlinkToneHz: null,
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    includeInWrite: true,
  };
}

function makeSatellite(): Satellite {
  return {
    id: 'sat-1',
    projectId: 'proj-1',
    revision: 1,
    updatedAt: '2024-02-14T12:25:40Z',
    name: 'ISS',
    noradId: 25544,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993',
    tleLine2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001',
    epoch: '2024-02-14T12:25:40Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 247.4627,
    eccentricity: 0.0006703,
    argPerigeeDeg: 130.536,
    meanAnomalyDeg: 325.0288,
    meanMotionRevPerDay: 15.4956032,
    bstar: 0.00030589,
    elementSetNumber: 999,
    revolutionNumber: 43000,
    transmitters: [makeTransmitter()],
  };
}

describe('uploadOpenGd77SatelliteBank', () => {
  it('programs dirty FLASH sectors covering additional settings and SAVE_REBOOT', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.plantByte(OPENUV380_OFFSET.additionalSettings + 0x40, 0xaa);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);

    await uploadOpenGd77SatelliteBank(proto, packSatelliteBank([makeSatellite()]));

    const setSector = pipe.writes.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR,
    );
    expect(setSector.length).toBeGreaterThan(0);
    const sectorIndex = (setSector[0]![2]! << 16) | (setSector[0]![3]! << 8) | setSector[0]![4]!;
    expect(sectorIndex).toBe(OPENUV380_OFFSET.additionalSettings / 4096);
    const reboot = pipe.writes.some(
      (w) =>
        w[0] === OPENGD77_TYPE_COMMAND &&
        w[1] === OPENGD77_CMD_CONTROL &&
        w[2] === OPENGD77_CONTROL_SAVE_REBOOT,
    );
    expect(reboot).toBe(true);
  });
});
