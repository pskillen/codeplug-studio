import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

/** Presentation nest role for Channels wire preview (#560). */
export type WirePreviewNestRole = 'parent' | 'child';

export type WirePreviewTableRow = WirePreviewRow & {
  nestRole?: WirePreviewNestRole;
  /** Projection count under a parent chrome row. */
  nestChildCount?: number;
};

/**
 * Group flat channel preview rows under shaded parents when a library channel
 * expands to more than one projection. Single-row channels stay flat (no chrome).
 *
 * @param isParentExcluded — build-level parent-id skip (all projections).
 */
export function groupWirePreviewChannelRows(
  rows: readonly WirePreviewRow[],
  isParentExcluded?: (parentChannelId: string) => boolean,
): WirePreviewTableRow[] {
  const byParent = new Map<string, WirePreviewRow[]>();
  const order: string[] = [];

  for (const row of rows) {
    if (row.entityKind !== 'channel') {
      continue;
    }
    const parentId = row.libraryEntityId;
    if (!byParent.has(parentId)) {
      order.push(parentId);
      byParent.set(parentId, []);
    }
    byParent.get(parentId)!.push(row);
  }

  const nonChannel = rows.filter((row) => row.entityKind !== 'channel');
  const out: WirePreviewTableRow[] = [...nonChannel];

  for (const parentId of order) {
    const children = byParent.get(parentId)!;
    if (children.length <= 1) {
      out.push(children[0]!);
      continue;
    }

    const head = children[0]!;
    // Multi-mode preview may append " (FM)" to displayLabel — parent chrome uses the base name.
    const baseLabel =
      head.displayDetails?.find((d) => d.label === 'Channel')?.value ??
      head.displayLabel.replace(/\s*\((?:FM|DMR|D-STAR|YSF|P25|NXDN|M17|TETRA)\)\s*$/i, '');

    out.push({
      key: parentId,
      libraryEntityId: parentId,
      entityKind: 'channel',
      displayLabel: baseLabel.trim() || head.displayLabel,
      generatedWireName: '',
      effectiveWireName: '',
      hasWireNameOverride: false,
      hasOrderOrSlotOverride: head.hasOrderOrSlotOverride,
      excluded: isParentExcluded?.(parentId) ?? false,
      nestRole: 'parent',
      nestChildCount: children.length,
      rxFrequency: head.rxFrequency,
      txFrequency: head.txFrequency,
    });

    for (const child of children) {
      out.push({
        ...child,
        nestRole: 'child',
      });
    }
  }

  return out;
}

/**
 * Flatten nest groups for display: drop children whose parent is collapsed.
 * `collapsedParentIds` contains library entity ids.
 */
export function applyWirePreviewNestCollapse(
  nestedRows: readonly WirePreviewTableRow[],
  collapsedParentIds: ReadonlySet<string>,
): WirePreviewTableRow[] {
  const result: WirePreviewTableRow[] = [];
  let hideUnderParent: string | null = null;

  for (const row of nestedRows) {
    if (row.nestRole === 'parent') {
      hideUnderParent = collapsedParentIds.has(row.libraryEntityId) ? row.libraryEntityId : null;
      result.push(row);
      continue;
    }
    if (row.nestRole === 'child' && hideUnderParent === row.libraryEntityId) {
      continue;
    }
    if (row.nestRole !== 'child') {
      hideUnderParent = null;
    }
    result.push(row);
  }

  return result;
}

/** Parent chrome + children matching search (or all children when parent label matches). */
export function filterNestedWirePreviewRows(
  nestedRows: readonly WirePreviewTableRow[],
  query: string,
): WirePreviewTableRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...nestedRows];

  const result: WirePreviewTableRow[] = [];
  let i = 0;
  while (i < nestedRows.length) {
    const row = nestedRows[i]!;
    if (row.nestRole !== 'parent') {
      if (wirePreviewRowSearchText(row).includes(q)) result.push(row);
      i += 1;
      continue;
    }

    const children: WirePreviewTableRow[] = [];
    let j = i + 1;
    while (j < nestedRows.length && nestedRows[j]!.nestRole === 'child') {
      children.push(nestedRows[j]!);
      j += 1;
    }

    const parentMatches = wirePreviewRowSearchText(row).includes(q);
    const matchingChildren = parentMatches
      ? children
      : children.filter((child) => wirePreviewRowSearchText(child).includes(q));

    if (parentMatches || matchingChildren.length > 0) {
      result.push(row);
      result.push(...matchingChildren);
    }
    i = j;
  }

  return result;
}

export function wirePreviewRowSearchText(row: WirePreviewRow): string {
  return [
    row.displayLabel,
    row.libraryCallsign ?? '',
    row.generatedWireName,
    row.effectiveWireName,
    row.expansionNote ?? '',
    ...(row.displayDetails?.map((d) => `${d.label} ${d.value}`) ?? []),
  ]
    .join(' ')
    .toLowerCase();
}
