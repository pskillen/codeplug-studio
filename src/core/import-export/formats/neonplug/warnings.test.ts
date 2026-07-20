import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newDigitalContact,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { collectNeonplugExportWarnings } from './warnings.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('neonplug/warnings', () => {
  it('warns when DM32UV org entity counts exceed profile caps', () => {
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: Array.from({ length: 4001 }, (_, i) => ({
        entity: { ...newChannel(projectId, `Ch${i}`), id: `ch-${i}` },
        wireName: `Ch${i}`,
      })),
      zones: Array.from({ length: 251 }, (_, i) => ({
        zoneId: `z-${i}`,
        wireName: `Z${i}`,
        memberChannelIds: [],
      })),
      talkGroups: Array.from({ length: 200 }, (_, i) => ({
        entity: { ...newTalkGroup(projectId, `TG${i}`, i + 1), id: `tg-${i}` },
        wireName: `TG${i}`,
      })),
      digitalContacts: Array.from({ length: 60 }, (_, i) => ({
        entity: { ...newDigitalContact(projectId, `DC${i}`, 1_000_000 + i), id: `dc-${i}` },
        wireName: `DC${i}`,
      })),
      analogContacts: [],
      rxGroupLists: Array.from({ length: 33 }, (_, i) => ({
        entity: { ...newRxGroupList(projectId, `RX${i}`), id: `rx-${i}` },
        wireName: `RX${i}`,
      })),
      scanLists: [],
      zoneGrouping: {
        kind: 'zoneGrouping',
        zones: Array.from({ length: 16 }, (_, i) => ({
          id: `z-${i}`,
          name: `Z${i}`,
          channelIds: [],
          exportScanList: true,
        })),
      },
    };

    const warnings = collectNeonplugExportWarnings(assembled);
    expect(warnings.some((w) => /4001 channel/.test(w))).toBe(true);
    expect(warnings.some((w) => /251 zone/.test(w))).toBe(true);
    expect(warnings.some((w) => /260 talk group/.test(w))).toBe(true);
    expect(warnings.some((w) => /33 RX group/.test(w))).toBe(true);
    expect(warnings.some((w) => /16 zone-derived scan/.test(w))).toBe(true);
  });

  it('does not warn for empty UV5R org arrays', () => {
    const assembled: AssembledBuild = {
      buildId: 'b2',
      formatId: 'neonplug',
      profileId: 'neonplug-uv5rmini',
      buildName: 'UV5R',
      channels: [{ entity: { ...newChannel(projectId, 'A'), id: 'ch-1' }, wireName: 'A' }],
      zones: [{ zoneId: 'z-1', wireName: 'Z', memberChannelIds: [] }],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    expect(collectNeonplugExportWarnings(assembled)).toEqual([]);
  });
});
