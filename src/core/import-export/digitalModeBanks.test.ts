import { describe, expect, it } from 'vitest';
import {
  newDigitalContact,
  newRadioBuildForProfile,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import { resolveWireNames } from '@core/services/resolveWireNames.ts';
import type { ExportWarning } from './exportWarning.ts';
import {
  keepDigitalModeTalkGroupsAndContacts,
  keepDmrTalkGroupsAndContacts,
} from './dmrContactBanks.ts';

const P = 'p1';
const dmrTg = { ...newTalkGroup(P, 'Same', 91, 'dmr'), id: 'dmr-tg' };
const nxTg = { ...newTalkGroup(P, 'Same', 1234, 'nxdn'), id: 'nx-tg' };
const nxDc = { ...newDigitalContact(P, 'Alice', 5678, 'nxdn'), id: 'nx-dc' };

function assembled(): AssembledBuild {
  const row = <T>(entity: T) => ({ entity, wireName: (entity as { name: string }).name });
  return {
    buildId: 'b',
    formatId: 'anytone',
    profileId: 'anytone-at-d890uv',
    buildName: 'b',
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [row(dmrTg), row(nxTg)],
    digitalContacts: [row(nxDc)],
    analogContacts: [],
    rxGroupLists: [
      {
        entity: {
          id: 'rx',
          projectId: P,
          revision: 1,
          updatedAt: '',
          name: 'Mixed',
          members: [
            { ref: { kind: 'talkGroup', id: 'dmr-tg' } },
            { ref: { kind: 'talkGroup', id: 'nx-tg' } },
          ],
        },
        wireName: 'Mixed',
      },
    ],
  } as unknown as AssembledBuild;
}

describe('keepDigitalModeTalkGroupsAndContacts (G14)', () => {
  it('keeps one mode, filters RX members, and warns for DMR like keepDmrTalkGroupsAndContacts', () => {
    const a: ExportWarning[] = [];
    const b: ExportWarning[] = [];
    const viaWrapper = keepDmrTalkGroupsAndContacts(assembled(), a);
    const viaMode = keepDigitalModeTalkGroupsAndContacts(assembled(), 'dmr', b);
    expect(viaMode).toEqual(viaWrapper);
    expect(b).toEqual(a);
    expect(a).toHaveLength(1);
    expect(viaMode.talkGroups.map((r) => r.entity.id)).toEqual(['dmr-tg']);
    expect(viaMode.digitalContacts).toEqual([]);
    expect(viaMode.rxGroupLists[0]!.entity.members.map((m) => m.ref.id)).toEqual(['dmr-tg']);
  });

  it('keeps the NXDN entities and, quietly, drops the DMR ones', () => {
    const warnings: ExportWarning[] = [];
    const out = keepDigitalModeTalkGroupsAndContacts(assembled(), 'nxdn', warnings, {
      quiet: true,
    });
    expect(out.talkGroups.map((r) => r.entity.id)).toEqual(['nx-tg']);
    expect(out.digitalContacts.map((r) => r.entity.id)).toEqual(['nx-dc']);
    expect(out.rxGroupLists[0]!.entity.members.map((m) => m.ref.id)).toEqual(['nx-tg']);
    expect(warnings).toEqual([]);
  });
});

describe('wire-name pool per digital mode (G15)', () => {
  const library = {
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [nxTg, dmrTg],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
  } as unknown as LibrarySlice;
  const { build, egress } = newRadioBuildForProfile(P, 'radio-io-at-d890uv');
  const resolve = (digitalMode?: 'dmr' | 'nxdn') =>
    new Map(
      resolveWireNames({
        build,
        library,
        entityKind: 'talkGroup',
        formatId: egress.formatId,
        profileId: egress.profileId,
        ...(digitalMode ? { digitalMode } : {}),
      }).map((r) => [r.libraryEntityId, r.effective]),
    );

  it('without a mode, a DMR and an NXDN talk group with the same name get different wire names', () => {
    const names = resolve();
    expect(names.get('dmr-tg')).not.toBe(names.get('nx-tg'));
  });

  it('with a mode, each bank keeps its own name and the other mode is not resolved', () => {
    const dmr = resolve('dmr');
    expect([...dmr.keys()]).toEqual(['dmr-tg']);
    expect(dmr.get('dmr-tg')).toBe('Same');
    const nx = resolve('nxdn');
    expect([...nx.keys()]).toEqual(['nx-tg']);
    expect(nx.get('nx-tg')).toBe('Same');
  });
});
