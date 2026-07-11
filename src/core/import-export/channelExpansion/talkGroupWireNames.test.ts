import { describe, expect, it } from 'vitest';
import type { TalkGroup } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { newTalkGroup } from '@core/domain/factories.ts';
import { applyTalkGroupWireNameLimits, buildTalkGroupWireNameMap } from './talkGroupWireNames.ts';

function assembledTalkGroup(tg: TalkGroup, wireName?: string): AssembledBuild {
  return {
    buildId: 'build-1',
    formatId: 'opengd77',
    profileId: 'opengd77-1701',
    buildName: 'Test',
    channels: [],
    zones: [],
    talkGroups: [{ entity: tg, wireName: wireName ?? tg.name }],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

describe('talkGroupWireNames', () => {
  it('keeps short names unchanged', () => {
    const reserved = new Set<string>();
    const tg = newTalkGroup('p', 'Local', 9);
    expect(
      applyTalkGroupWireNameLimits(
        'Local',
        tg,
        reserved,
        { shortenNames: true },
        'opengd77-1701',
        [],
      ),
    ).toBe('Local');
  });

  it('warns when abbreviation shortens an over-limit talk group name', () => {
    const reserved = new Set<string>();
    const tg = { ...newTalkGroup('p', 'Scotland West Region', 23559), abbreviation: 'Scot West' };
    const warnings: string[] = [];
    expect(
      applyTalkGroupWireNameLimits(
        'Scotland West Region',
        tg,
        reserved,
        { shortenNames: true, useTalkGroupAbbreviation: true },
        'opengd77-1701',
        warnings,
      ),
    ).toBe('Scot West');
    expect(warnings[0]).toContain('exported as "Scot West"');
  });

  it('shortens when abbreviation is still too long', () => {
    const reserved = new Set<string>();
    const tg = {
      ...newTalkGroup('p', 'International Emergency Network', 1),
      abbreviation: 'International Emer',
    };
    const wire = applyTalkGroupWireNameLimits(
      'International Emergency Network',
      tg,
      reserved,
      { shortenNames: true, useTalkGroupAbbreviation: true },
      'opengd77-1701',
      [],
    );
    expect(wire.length).toBeLessThanOrEqual(16);
    expect(wire).not.toBe('International Emer');
  });

  it('skips abbreviation when useTalkGroupAbbreviation is false', () => {
    const reserved = new Set<string>();
    const tg = { ...newTalkGroup('p', 'Scotland West Region', 23559), abbreviation: 'Scot West' };
    const wire = applyTalkGroupWireNameLimits(
      'Scotland West Region',
      tg,
      reserved,
      { shortenNames: true, useTalkGroupAbbreviation: false },
      'opengd77-1701',
      [],
    );
    expect(wire).not.toBe('Scot West');
    expect(wire.length).toBeLessThanOrEqual(16);
  });

  it('builds a shared map from assembled talk groups', () => {
    const tg = {
      ...newTalkGroup('p', 'Very Long Talk Group Name', 1),
      abbreviation: 'VL TGN',
    };
    const map = buildTalkGroupWireNameMap(assembledTalkGroup(tg), { shortenNames: true });
    expect(map.get(tg.id)).toBe('VL TGN');
  });

  it('respects build wire name overrides as the base label', () => {
    const tg = { ...newTalkGroup('p', 'Library Name Too Long', 1), abbreviation: 'Short' };
    const map = buildTalkGroupWireNameMap(assembledTalkGroup(tg, 'Override Name'), {
      shortenNames: true,
    });
    expect(map.get(tg.id)).toBe('Override Name');
  });
});
