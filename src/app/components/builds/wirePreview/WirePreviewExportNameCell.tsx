import { Group, Text } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { useState } from 'react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { RowActionIcon } from '../../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { ResolutionFieldRow } from '../../../lib/wirePreviewResolution.ts';
import WireNameInlineEditor, { type WireNameSuggestion } from './WireNameInlineEditor.tsx';
import WireNameRemediationMarker from './WireNameRemediationMarker.tsx';
import WireResolutionSection from './WireResolutionSection.tsx';
import { wireNameCommittedValue } from './wirePreviewRowUtils.ts';

export interface WirePreviewExportNameCellProps {
  row: WirePreviewRow;
  nameLimit?: number;
  disabled?: boolean;
  suggestions: WireNameSuggestion[];
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  /** Channel rows only — Resolution section shown below the editor while editing. */
  resolutionFields?: ResolutionFieldRow[];
}

/**
 * Export name cell for the CPS wire-preview table (wire-preview rework phase 6,
 * ux-proposal.md §2/§3) — read state is a label + remediation marker + pencil; the pencil
 * swaps the cell for the shared `WireNameInlineEditor` in place, no modal.
 */
export default function WirePreviewExportNameCell({
  row,
  nameLimit,
  disabled = false,
  suggestions,
  onWireNameChange,
  resolutionFields,
}: WirePreviewExportNameCellProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div onClick={(event) => event.stopPropagation()}>
        <WireNameInlineEditor
          committedValue={wireNameCommittedValue(row)}
          suggestions={suggestions}
          limit={nameLimit}
          disabled={disabled}
          autoFocus
          onCommit={(value) => {
            onWireNameChange(row, value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
        {resolutionFields && resolutionFields.length > 0 ? (
          <WireResolutionSection fields={resolutionFields} />
        ) : null}
      </div>
    );
  }

  return (
    <Group gap={6} wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <Text size="sm" fw={row.hasWireNameOverride ? 600 : 400}>
        {row.effectiveWireName}
      </Text>
      <WireNameRemediationMarker
        remediation={row.remediation}
        originalName={row.displayLabel}
        limit={nameLimit}
      />
      <RowActionIcon
        icon={<IconPencil size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        label="Edit export name"
        disabled={disabled}
        onClick={() => setEditing(true)}
      />
    </Group>
  );
}
