import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

function editorSlugForRow(row: WirePreviewRow): string | null {
  switch (row.entityKind) {
    case 'channel':
      return 'channels';
    case 'zone':
      return 'zones';
    case 'talkGroup':
      return 'talk-groups';
    case 'rxGroupList':
      return 'rx-group-lists';
    case 'contact':
      return row.displayLabel.includes('(analog)') ? 'analog-contacts' : 'digital-contacts';
    case 'scanList':
      return null;
  }
}

export function libraryEditPathForWirePreviewRow(row: WirePreviewRow): string | null {
  const slug = editorSlugForRow(row);
  if (slug === null) return null;
  return `/library/${slug}/${row.libraryEntityId}`;
}
