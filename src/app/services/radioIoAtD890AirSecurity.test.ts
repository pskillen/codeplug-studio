import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import {
  AIRSECURITY_SEED_ADDRESS,
  encodeAirSecuritySeedRecord,
} from '@integrations/radio-io/radios/at-d890uv/airSecuritySeed.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  AtD890ScriptedPipe,
  collectAtD890WriteDataAddresses,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
  writePayloadAt,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import {
  readAtD890AirSecuritySeedSet,
  writeAtD890AirSecuritySeed,
} from './radioIoAtD890AirSecurity.ts';
import { RadioWriteBlockedError } from './radioIoSession.ts';
import { allowLeakedD890MarkersInThisFile } from '../../test/leakedD890Marker.ts';

allowLeakedD890MarkersInThisFile();

const SERIAL = 'SN-TEST-AIRSEC';
const SECRET = new TextEncoder().encode('12345678901234567890');

async function connectedSession(profileId: string, seedRecord?: Uint8Array) {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  const settings = makeAtD890EraseUnitBuffer();
  for (let i = 0; i < 0x160; i++) settings[i] = (i * 3 + 1) & 0xff;
  settings.set([0x41, 0x42], 0x900);
  settings[0x1280] = 0x33;
  settings.fill(0x5a, 0x200, 0x220);
  if (seedRecord) settings.set(seedRecord, 0x220);
  scriptAtD890UploadReadResponder(
    pipe,
    new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [0x350_0000, settings],
    ]),
  );
  enableAtD890AutoWriteAck(pipe);
  const session: RadioSession = { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio };
  const { egress } = newRadioBuildForProfile('p1', profileId);
  return { pipe, radio, session, egress, settings };
}

describe('AT-D890UV AirSecurity seed service', () => {
  it('reads a set record as true and zeros the bytes it was handed', async () => {
    const record = encodeAirSecuritySeedRecord(SECRET);
    const { session, radio } = await connectedSession('radio-io-at-d890uv-mm9pdy', record);
    const read = radio.readAirSecuritySeedRecord.bind(radio);
    let handed: Uint8Array | undefined;
    radio.readAirSecuritySeedRecord = async (opts) => {
      const bytes = await read(opts);
      handed = bytes;
      return bytes;
    };

    await expect(readAtD890AirSecuritySeedSet(session)).resolves.toBe(true);
    expect(handed).toBeDefined();
    expect([...handed!].every((b) => b === 0)).toBe(true);
  });

  it('reads a blank record as false', async () => {
    const { session } = await connectedSession('radio-io-at-d890uv-mm9pdy');
    await expect(readAtD890AirSecuritySeedSet(session)).resolves.toBe(false);
  });

  it('writes the encoded record and zeros the patch bytes, not the caller seed', async () => {
    const record = encodeAirSecuritySeedRecord(SECRET);
    const { pipe, radio, session, egress } = await connectedSession('radio-io-at-d890uv-mm9pdy');
    const upload = radio.uploadSettingsPatches.bind(radio);
    let patchBytes: Uint8Array | undefined;
    radio.uploadSettingsPatches = async (patches, opts) => {
      patchBytes = patches[0]?.bytes;
      return upload(patches, opts);
    };
    const caller = SECRET.slice();

    const result = await writeAtD890AirSecuritySeed(session, egress, caller);

    expect([...caller]).toEqual([...SECRET]);
    expect(patchBytes).toBeDefined();
    expect([...patchBytes!].every((b) => b === 0)).toBe(true);
    expect(writePayloadAt(pipe, AIRSECURITY_SEED_ADDRESS)).toEqual(record.subarray(0, 16));
    expect(writePayloadAt(pipe, AIRSECURITY_SEED_ADDRESS + 16)).toEqual(record.subarray(16, 32));
    expect(writePayloadAt(pipe, 0x03500200)).toEqual(new Uint8Array(16).fill(0x5a));
    expect(result.writeVerifyPending?.staging.chunks.length).toBeGreaterThan(0);
  });

  it('clears the record with 32 zero bytes', async () => {
    const { pipe, session, egress } = await connectedSession(
      'radio-io-at-d890uv-mm9pdy',
      encodeAirSecuritySeedRecord(SECRET),
    );

    await writeAtD890AirSecuritySeed(session, egress, null);

    expect(writePayloadAt(pipe, AIRSECURITY_SEED_ADDRESS)).toEqual(new Uint8Array(16));
    expect(writePayloadAt(pipe, AIRSECURITY_SEED_ADDRESS + 16)).toEqual(new Uint8Array(16));
    expect(writePayloadAt(pipe, 0x03500200)).toEqual(new Uint8Array(16).fill(0x5a));
  });

  it('refuses a stock target before any frame', async () => {
    const { pipe, session, egress } = await connectedSession('radio-io-at-d890uv');
    const before = pipe.writes.length;

    await expect(writeAtD890AirSecuritySeed(session, egress, SECRET)).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
    expect(pipe.writes.length).toBe(before);
    expect(collectAtD890WriteDataAddresses(pipe)).toEqual([]);
  });
});
