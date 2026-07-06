import { describe, expect, it } from 'vitest';
import { isSingleFileProjectExportAdapter } from '../../exportAdapter.ts';
import { isSingleFileProjectImportAdapter } from '../../importAdapter.ts';
import { getExportAdapter, getImportAdapter } from '../../registry.ts';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';
import {
  FIXTURE_CHANNEL_B_ID,
  FIXTURE_CHILD_ZONE_ID,
  FIXTURE_PARENT_ZONE_ID,
  glasgowPmrNestedAggregate,
  nestedZonesAggregate,
  projectWithFormatBuildAggregate,
} from './testFixtures.ts';

describe('native-yaml round-trip smoke', () => {
  it('serialise → parse preserves aggregate via adapters', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const exportAdapter = getExportAdapter('native-yaml');
    const importAdapter = getImportAdapter('native-yaml');

    if (!isSingleFileProjectExportAdapter(exportAdapter)) {
      throw new Error('expected single-file export adapter');
    }
    if (!isSingleFileProjectImportAdapter(importAdapter)) {
      throw new Error('expected single-file import adapter');
    }

    const { content } = exportAdapter.serialise(aggregate);
    const { project } = importAdapter.parseDocument(content);

    expect(project).toEqual(aggregate);
  });

  it('serialise → parse via module functions', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const yaml = serialiseProject(aggregate);
    expect(parseProjectDocument(yaml)).toEqual(aggregate);
  });

  it('preserves TalkGroup.abbreviation on round-trip', () => {
    const aggregate = projectWithFormatBuildAggregate();
    expect(aggregate.talkGroups[0]?.abbreviation).toBe('Sco');
    const yaml = serialiseProject(aggregate);
    const parsed = parseProjectDocument(yaml);
    expect(parsed.talkGroups[0]?.abbreviation).toBe('Sco');
  });

  it('preserves nested zone members on round-trip', () => {
    const aggregate = nestedZonesAggregate();
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    const parent = parsed.zones.find((zone) => zone.id === FIXTURE_PARENT_ZONE_ID);
    expect(parent?.members).toEqual([
      { kind: 'zone', zoneId: FIXTURE_CHILD_ZONE_ID },
      { kind: 'channel', channelId: FIXTURE_CHANNEL_B_ID },
    ]);
  });

  it('preserves omitFromExport on round-trip', () => {
    const aggregate = glasgowPmrNestedAggregate();
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    const pmr = parsed.zones.find((zone) => zone.id === FIXTURE_CHILD_ZONE_ID);
    expect(pmr?.omitFromExport).toBe(true);
    expect(pmr?.name).toBe('PMR446');
  });
});
