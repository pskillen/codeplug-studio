import { expect, it } from 'vitest';
import { newChannel, newProjectMeta, newZone } from '@core/domain/factories.ts';
import { assemble, librarySliceFrom } from '@core/services/assemble.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import type { RadioLibraryRead } from '@integrations/radio-io/readIntoLibrary.ts';
import { LibraryService } from '@app/state/libraryService.ts';
import { BuildService } from '@app/state/buildService.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';
import { applyRadioReadToLibrary } from './radioReadIntoLibrary.ts';

it.each(['radio-io-uv5r-mini', 'radio-io-uv5r-mini-mm9pdy'])(
  'writes modelled fields after a read: %s',
  async (profileId) => {
    const persistence = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    await persistence.seedProject({ meta });
    const channels: RadioLibraryRead['channels'] = [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'Local',
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'ctcss', hz: 88.5 },
        txTone: { kind: 'dcs', code: 23, polarity: 'I' },
        powerPercent: 20,
        bandwidth: 'NFM',
        scanAdd: true,
        rxOnly: false,
      },
      {
        slotIndex: 2,
        empty: false,
        wireName: 'Air',
        rxHz: 125000000,
        txHz: 125000000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        scanAdd: false,
        rxOnly: true,
        analogMode: 'am',
      },
    ];
    const mod = profileId.endsWith('mm9pdy');
    const read: RadioLibraryRead = {
      profileId,
      modelLabel: 'Mini',
      firmwareLabel: 'Test',
      channels,
      zones: mod ? [{ wireName: 'Local', channelNumbers: [1, 2], scanChannelNumbers: [1] }] : [],
      droppedFields: [],
      notes: [],
    };
    const args = { persistence, projectId: meta.projectId, read };
    expect((await applyRadioReadToLibrary(args)).ok).toBe(true);
    await persistence.putChannel(newChannel(meta.projectId, 'Extra'), null);
    await persistence.putZone(newZone(meta.projectId, 'Extra'), null);
    expect((await applyRadioReadToLibrary(args)).ok).toBe(true);
    const library = await new LibraryService(persistence).loadLibrary(meta.projectId);
    const build = (await new BuildService(persistence).listBuilds(meta.projectId))[0]!;
    const slice = librarySliceFrom(library);
    const output = buildRadioWriteProjection(assemble(build, slice), build, slice, {
      formatId: 'radio-io',
      profileId,
    });
    expect(library.channels).toHaveLength(3);
    expect(output.channels).toHaveLength(2);
    for (const input of channels) {
      const result = output.channels.find((channel) => channel.wireName === input.wireName)!;
      expect(result).toMatchObject({
        slotIndex: input.slotIndex,
        wireName: input.wireName,
        rxHz: input.rxHz,
        txHz: input.txHz,
        rxTone: input.rxTone,
        txTone: input.txTone,
        powerPercent: input.powerPercent,
        bandwidth: input.bandwidth,
        scanAdd: input.scanAdd,
      });
      expect(result.rxOnly ?? false).toBe(input.rxOnly);
    }
    if (mod)
      expect(output.organisation.zones).toMatchObject([
        { wireName: 'Local', channelNumbers: [1, 2], scanChannelNumbers: [1] },
      ]);
  },
);
