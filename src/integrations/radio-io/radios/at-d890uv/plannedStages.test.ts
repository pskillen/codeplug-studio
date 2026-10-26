import { describe, expect, it } from 'vitest';
import { expectPlanMatchesEmitted, stageRecorder } from '../../plannedStagesTestKit.ts';
import { planForOperation } from '../../plannedStages.ts';
import type { RadioSession } from '../../types.ts';
import { AT_D890UV_DESCRIPTOR } from './descriptor.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import { AtD890uvProtocol } from './protocol.ts';
import {
  AtD890ScriptedPipe,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890MinimalDownload,
  scriptAtD890UploadReadResponder,
} from './__fixtures__/scriptedPipe.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import {
  applyAtD890WriteImageToCache,
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
} from './memory.ts';

const SERIAL = 'SN-TEST-UPLOAD01';

describe('AT-D890UV planned stages', () => {
  it('declares the download list a read emits, and the same for a backup', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const rec = stageRecorder();
    await radio.download({ onProgress: rec.onProgress });
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'read')!;
    expectPlanMatchesEmitted(plan, rec.stages);
    expect(planForOperation(AT_D890UV_DESCRIPTOR, 'backup')).toEqual(plan);
    expect(planForOperation(AT_D890UV_DESCRIPTOR, 'restore')).toBeUndefined();
  });

  it('declares every stage a write emits once the session holds a read', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const unit348 = makeAtD890EraseUnitBuffer();
    unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
    unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
    scriptAtD890UploadReadResponder(
      pipe,
      new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
        [0x100_0000, makeAtD890EraseUnitBuffer()],
        [0x348_0000, unit348],
      ]),
    );
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
    enableAtD890AutoWriteAck(pipe);

    const session: RadioSession = { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio };
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'write', { session })!;
    // The session already holds a read, so the plan has no download stages.
    expect(plan.map((s) => s.label)).toEqual(['Preserving untouched settings', 'Upload']);

    const rec = stageRecorder();
    await radio.upload(image, { onProgress: rec.onProgress });
    expectPlanMatchesEmitted(plan, rec.stages);
  }, 20_000);

  it('puts the download stages first when a write has to read, then the write stages', () => {
    const labels = planForOperation(AT_D890UV_DESCRIPTOR, 'write')!.map((s) => s.label);
    expect(labels.slice(0, 2)).toEqual(['Local info', 'Optional settings / alarm']);
    expect(labels.slice(-2)).toEqual(['Preserving untouched settings', 'Upload']);
  });

  it('adds contact and keps stages only for the parts being written', () => {
    const parts = { codeplug: true, contacts: true, settings: false, keps: true };
    const labels = planForOperation(AT_D890UV_DESCRIPTOR, 'write', { parts })!.map((s) => s.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Preserving untouched contact data',
        'Digital contacts',
        'Preserving untouched satellite data',
      ]),
    );
    const none = planForOperation(AT_D890UV_DESCRIPTOR, 'write')!.map((s) => s.label);
    expect(none).not.toContain('Digital contacts');
  });
});
