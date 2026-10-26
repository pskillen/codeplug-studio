/**
 * Golden transmitted frames for `upload()` (#1393).
 *
 * Pins every `W` frame the stock RMW, MM9PDY step-key and MM9PDY location-table Writes put on
 * the wire, so a refactor of the upload core cannot change a transmitted byte unnoticed. The
 * fixture is synthetic: scripted radio memory, no owner data.
 *
 * Regenerate only on purpose: `D890_GOLDEN_OUT=<file> npx vitest run protocol.golden.test.ts`
 * writes the fixture module; review the diff like a protocol change.
 */

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AT_D890_CHANNEL_LOCATION, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import {
  applyAtD890WriteImageToCache,
  atD890UploadBankIntentFromOrganisation,
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
} from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';
import {
  AtD890ScriptedPipe,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
} from './__fixtures__/scriptedPipe.ts';
import { UPLOAD_GOLDEN_FRAMES, type GoldenFrame } from './__fixtures__/uploadGoldenFrames.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';

const SERIAL = 'SN-TEST-UPLOAD01';

function seedChannelZeroUpload(radio: AtD890uvProtocol): ReturnType<typeof cacheToMemoryMap> {
  const channelSet = new Uint8Array(0x200);
  setBitmapBit(channelSet, 0, true);
  const primary = new Uint8Array(0x40);
  primary.set(encodeBcdFrequencyHz(145_520_000), 0);
  radio.seedDownloadCache({
    blocks: new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [D890_MAP.ChannelSet, channelSet],
      [channelPrimaryAddress(0), primary],
      [channelSecondaryAddress(0), new Uint8Array(0x40)],
      [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
    ]),
  });
  const image = cacheToMemoryMap(radio.getDownloadCache()!);
  applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
  return image;
}

/** Radio memory with distinctive bytes across the settings unit so any stray change shows. */
function radioMemory(): Map<number, Uint8Array> {
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  const settings = makeAtD890EraseUnitBuffer();
  for (let i = 0; i < 0x160; i++) settings[i] = (i * 7 + 1) & 0xff;
  settings[0x200] = 0x5a;
  settings.set([0x41, 0x42, 0x43], 0x900);
  settings[0x1280] = 0x33;
  const unit100 = makeAtD890EraseUnitBuffer();
  return new Map([
    [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
    [0x100_0000, unit100],
    [0x348_0000, unit348],
    [0x350_0000, settings],
  ]);
}

function located(): RadioChannelDto {
  return {
    slotIndex: 1,
    empty: false,
    wireName: '',
    rxHz: 145_520_000,
    txHz: 145_520_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: null,
    bandwidth: 'NFM',
    useLocation: true,
    location: { lat: 55.852056, lon: -4.259463 },
  };
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function transmittedFrames(
  intent: ReturnType<typeof atD890UploadBankIntentFromOrganisation>,
  extraMemory?: Map<number, Uint8Array>,
): Promise<GoldenFrame[]> {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  const memory = radioMemory();
  for (const [k, v] of extraMemory ?? []) memory.set(k, v);
  scriptAtD890UploadReadResponder(pipe, memory);
  const image = seedChannelZeroUpload(radio);
  radio.setUploadBankIntent(intent);
  enableAtD890AutoWriteAck(pipe);
  await radio.upload(image, {});
  return pipe.writes
    .filter((w) => w[0] === 0x57)
    .map((w) => ({
      address: ((w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!) >>> 0,
      hex: toHex(w),
    }));
}

function locationUnit(): Uint8Array {
  const unit = makeAtD890EraseUnitBuffer();
  unit.fill(0x55, 0, 0x10);
  unit.set([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09], 0x1000);
  unit.fill(0xab, 0x2000, 0x2010);
  return unit;
}

const SCENARIOS: Record<string, () => Promise<GoldenFrame[]>> = {
  stockRmw: () => transmittedFrames(atD890UploadBankIntentFromOrganisation({}, [])),
  stepKeys: () =>
    transmittedFrames(atD890UploadBankIntentFromOrganisation({ assignMm9pdyStepKeys: true }, [])),
  locationTable: () =>
    transmittedFrames(
      atD890UploadBankIntentFromOrganisation(
        { writeChannelLocationTable: true, channelDistanceUnit: 'mi' },
        [located()],
      ),
      new Map([[AT_D890_CHANNEL_LOCATION.BASE_ADDRESS, locationUnit()]]),
    ),
};

describe('AT-D890 upload golden frames', () => {
  const out = process.env.D890_GOLDEN_OUT;
  if (out) {
    it('writes the golden fixture', async () => {
      const all: Record<string, GoldenFrame[]> = {};
      for (const [name, run] of Object.entries(SCENARIOS)) all[name] = await run();
      const body = `/**\n * Synthetic golden \`W\` frames for \`upload()\` scenarios. See protocol.golden.test.ts.\n */\n\nexport interface GoldenFrame {\n  address: number;\n  hex: string;\n}\n\nexport const UPLOAD_GOLDEN_FRAMES: Record<string, GoldenFrame[]> = ${JSON.stringify(all, null, 2)};\n`;
      writeFileSync(out, body);
    }, 60_000);
    return;
  }

  for (const name of Object.keys(SCENARIOS)) {
    it(`${name} transmits exactly the recorded frames`, async () => {
      const frames = await SCENARIOS[name]!();
      expect(frames.length).toBeGreaterThan(0);
      expect(frames).toEqual(UPLOAD_GOLDEN_FRAMES[name]);
    }, 60_000);
  }
});
