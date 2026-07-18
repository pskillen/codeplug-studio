import { describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import {
  fullLibraryAggregate,
  minimalProjectAggregate,
} from '@core/import-export/formats/native-yaml/testFixtures.ts';
import {
  buildProjectSyncDiff,
  formatSyncDiffSummary,
  formatSyncTimestamp,
  hasPortableInterchange,
  isRemotePortableNewer,
  portableInterchangeLabel,
  summariseProjectAggregate,
} from './projectSyncSummary.ts';
import { recordImportDestination } from './interchangeMeta.ts';

describe('projectSyncSummary', () => {
  it('summarises entity counts from aggregate including APRS', () => {
    const aggregate = fullLibraryAggregate();
    const summary = summariseProjectAggregate(aggregate);
    expect(summary.counts.channels).toBeGreaterThan(0);
    expect(summary.counts.digitalContacts).toBe(1);
    expect(summary.counts.analogContacts).toBe(1);
    expect(summary.counts.rxGroupLists).toBe(1);
    expect(summary.counts.aprsConfigurations).toBe(1);
    expect(summary.projectId).toBe(aggregate.meta.projectId);
  });

  it('buildProjectSyncDiff includes all count rows and timestamp newer sides', () => {
    const aggregate = minimalProjectAggregate();
    const local = summariseProjectAggregate(aggregate);
    const remote = summariseProjectAggregate({
      ...aggregate,
      meta: recordImportDestination(aggregate.meta, 'googleDrive', {
        fileName: 'remote.yaml',
        folderId: 'folder-1',
        fileId: 'file-1',
      }),
      channels: [...aggregate.channels, { ...aggregate.channels[0]!, id: 'ch-2', name: 'Two' }],
    });
    const diff = buildProjectSyncDiff(local, remote);
    expect(diff.timestamps).toHaveLength(2);
    expect(diff.counts.map((row) => row.key)).toEqual([
      'channels',
      'zones',
      'talkGroups',
      'digitalContacts',
      'analogContacts',
      'rxGroupLists',
      'scanLists',
      'aprsConfigurations',
      'formatBuilds',
    ]);
    const channels = diff.counts.find((row) => row.key === 'channels');
    expect(channels?.delta).toBe(1);
    expect(formatSyncDiffSummary(local, remote).some((line) => line.includes('Channels:'))).toBe(
      true,
    );
  });

  it('portableInterchangeLabel prefers google drive', () => {
    const meta = recordImportDestination(newProjectMeta('Demo'), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'f1',
      fileId: 'file-1',
    });
    expect(portableInterchangeLabel(meta)).toBe('Google Drive · demo.yaml');
    expect(hasPortableInterchange(meta)).toBe(true);
  });

  it('isRemotePortableNewer ignores small export-upload skew', () => {
    const localSyncedAt = '2026-07-09T14:04:46.000Z';
    expect(isRemotePortableNewer('2026-07-09T14:04:47.500Z', localSyncedAt)).toBe(false);
    expect(isRemotePortableNewer('2026-07-09T14:04:49.500Z', localSyncedAt)).toBe(true);
    expect(isRemotePortableNewer(null, localSyncedAt)).toBe(false);
  });

  it('formatSyncTimestamp uses 24-hour clock and locale-aware date order', () => {
    const formatted = formatSyncTimestamp('2026-07-09T15:04:00.000Z', 'en-GB');
    expect(formatted).toMatch(/09\/07\/2026/);
    expect(formatted).toMatch(/\b1[456]:04\b/); // UTC→BST may shift hour; still 24h
    expect(formatted).not.toMatch(/AM|PM/i);
  });

  it('buildProjectSyncDiff labels Drive/file save instead of portable sync jargon', () => {
    const aggregate = minimalProjectAggregate();
    const summary = summariseProjectAggregate(aggregate);
    const diff = buildProjectSyncDiff(summary, summary);
    expect(diff.timestamps.map((row) => row.label)).toEqual([
      'Last edited',
      'Last Drive or file save',
    ]);
  });
});
