import { describe, expect, it } from 'vitest';
import { expectEventsFollowPlan, stageRecorder } from '../../plannedStagesTestKit.ts';
import { planForOperation } from '../../plannedStages.ts';
import type { RadioSession } from '../../types.ts';
import { AT_D890UV_DESCRIPTOR } from './descriptor.ts';
import { AT_D890_SAFE_SKIP_WRITE_ADDR, AT_D890_SATELLITE, D890_MAP } from './constants.ts';
import { AtD890uvProtocol } from './protocol.ts';
import { uploadAtD890DigitalContacts } from './digitalContactWrite.ts';
import { uploadAtD890SatelliteRecords } from './satelliteWrite.ts';

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
    expectEventsFollowPlan(plan, rec.events);
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
    expectEventsFollowPlan(plan, rec.events);
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

  it('the contact and keps writers emit the declared stages, in order, with Upload twice', async () => {
    const contacts = [
      {
        wireName: 'Contact 1',
        digitalId: 1234567,
        callsign: 'CALL',
        city: 'City',
        province: 'State',
        country: 'Country',
        remark: 'Note',
      },
    ];
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'write', {
      prepared: { channels: [], organisation: { zones: [], digitalContacts: contacts } },
      parts: { codeplug: true, contacts: true, settings: false, keps: true },
    })!;
    const labels = plan.map((s) => s.label);
    expect(labels.filter((l) => l === 'Upload')).toHaveLength(2);
    expect(labels.indexOf('Digital contacts')).toBeLessThan(labels.lastIndexOf('Upload'));

    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
    pipe.autoAckWrites = true;
    const rec = stageRecorder();
    await uploadAtD890DigitalContacts(pipe, contacts, { onProgress: rec.onProgress });
    const bytes = new Uint8Array(AT_D890_SATELLITE.RECORD_STRIDE).fill(0x11);
    await uploadAtD890SatelliteRecords(
      pipe,
      [{ satelliteId: 's', transmitterId: 't', address: AT_D890_SATELLITE.BASE_ADDRESS, bytes }],
      { onProgress: rec.onProgress },
    );
    // The tail of the plan is what these two writers emit; the codeplug part is covered above.
    const tail = plan.slice(labels.indexOf('Preserving untouched contact data'));
    expectEventsFollowPlan(tail, rec.events);
    expect(rec.stages).toEqual([
      'Preserving untouched contact data',
      'Digital contacts',
      'Preserving untouched satellite data',
      'Upload',
    ]);
  });
});

describe('AT-D890UV planned stages for Radio settings alone (#1393)', () => {
  it('plans one settings unit and an upload, with no download', () => {
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'write', {
      parts: { codeplug: false, contacts: false, settings: true, keps: false },
    })!;
    expect(plan.map((s) => s.label)).toEqual(['Preserving untouched settings', 'Upload']);
  });

  it('adds the keps stages when keps are ticked with it', () => {
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'write', {
      parts: { codeplug: false, contacts: false, settings: true, keps: true },
    })!;
    expect(plan.map((s) => s.label)).toEqual([
      'Preserving untouched settings',
      'Upload',
      'Preserving untouched satellite data',
      'Upload',
    ]);
  });

  it('keeps the codeplug plan when the codeplug is ticked with settings', () => {
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'write', {
      parts: { codeplug: true, contacts: false, settings: true, keps: false },
    })!;
    expect(plan[0]!.label).toBe('Local info');
  });
});
