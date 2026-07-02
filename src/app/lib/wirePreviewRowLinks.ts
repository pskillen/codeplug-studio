import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

function editorSlugForRow(row: WirePreviewRow): string {
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
  }
}

export function libraryEditPathForWirePreviewRow(row: WirePreviewRow): string {
  return `/library/${editorSlugForRow(row)}/${row.libraryEntityId}`;
}
