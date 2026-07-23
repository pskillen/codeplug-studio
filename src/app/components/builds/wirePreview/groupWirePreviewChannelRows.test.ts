import { describe, expect, it } from 'vitest';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import {
  applyWirePreviewNestCollapse,
  filterNestedWirePreviewRows,
  groupWirePreviewChannelRows,
} from './groupWirePreviewChannelRows.ts';

function channelRow(
  key: string,
  libraryEntityId: string,
  displayLabel: string,
  extras: Partial<WirePreviewRow> = {},
): WirePreviewRow {
  return {
    key,
    libraryEntityId,
    entityKind: 'channel',
    displayLabel,
    generatedWireName: displayLabel,
    effectiveWireName: displayLabel,
    hasWireNameOverride: false,
    hasOrderOrSlotOverride: false,
    excluded: false,
    ...extras,
  };
}

describe('groupWirePreviewChannelRows', () => {
  it('leaves single-projection channels flat', () => {
    const rows = [channelRow('ch-1', 'ch-1', 'Alpha'), channelRow('ch-2', 'ch-2', 'Bravo')];
    const nested = groupWirePreviewChannelRows(rows);
    expect(nested).toHaveLength(2);
    expect(nested.every((row) => row.nestRole == null)).toBe(true);
  });

  it('nests multiple projections under a shaded parent', () => {
    const rows = [
      channelRow('ch-1:-F', 'ch-1', 'Site (FM)'),
      channelRow('ch-1:-D', 'ch-1', 'Site (DMR)'),
      channelRow('ch-2', 'ch-2', 'Solo'),
    ];
    const nested = groupWirePreviewChannelRows(rows, (id) => id === 'ch-1');
    expect(nested[0]?.nestRole).toBe('parent');
    expect(nested[0]?.key).toBe('ch-1');
    expect(nested[0]?.excluded).toBe(true);
    expect(nested[0]?.nestChildCount).toBe(2);
    expect(nested[1]?.nestRole).toBe('child');
    expect(nested[2]?.nestRole).toBe('child');
    expect(nested[3]?.nestRole).toBeUndefined();
    expect(nested[3]?.key).toBe('ch-2');
  });

  it('collapses children when parent id is in the collapsed set', () => {
    const nested = groupWirePreviewChannelRows([
      channelRow('ch-1:-F', 'ch-1', 'Site (FM)'),
      channelRow('ch-1:-D', 'ch-1', 'Site (DMR)'),
    ]);
    const collapsed = applyWirePreviewNestCollapse(nested, new Set(['ch-1']));
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.nestRole).toBe('parent');
  });

  it('filters nest groups by child match while keeping parent chrome', () => {
    const nested = groupWirePreviewChannelRows([
      channelRow('ch-1:-F', 'ch-1', 'Site (FM)', {
        effectiveWireName: 'Alpha-F',
        generatedWireName: 'Alpha-F',
      }),
      channelRow('ch-1:-D', 'ch-1', 'Site (DMR)', {
        effectiveWireName: 'Alpha-D',
        generatedWireName: 'Alpha-D',
      }),
    ]);
    const filtered = filterNestedWirePreviewRows(nested, 'alpha-d');
    expect(filtered[0]?.nestRole).toBe('parent');
    expect(filtered).toHaveLength(2);
    expect(filtered[1]?.key).toBe('ch-1:-D');
  });
});
