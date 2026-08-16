import { Stack, Switch, Text, Tooltip } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { OverrideField } from '../../../v2/index.ts';
import WireNameInlineEditor from '../WireNameInlineEditor.tsx';
import WireNameRemediationMarker from '../WireNameRemediationMarker.tsx';
import { rowEffectivelyIncluded, wireNameCommittedValue } from '../wirePreviewRowUtils.ts';

export interface CommonOverrideSectionProps {
  row: WirePreviewRow;
  nameLimit?: number;
  showForceInclude: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
}

export default function CommonOverrideSection({
  row,
  nameLimit,
  showForceInclude,
  onExcludedChange,
  onForceIncludeChange,
  onWireNameChange,
}: CommonOverrideSectionProps) {
  const effectivelyIncluded = rowEffectivelyIncluded(row);
  const skippedByLibrary = row.omitFromExport === true;

  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>
        Export overrides
      </Text>
      {skippedByLibrary && showForceInclude && onForceIncludeChange ? (
        <Tooltip label="Export this zone as its own row in this build, despite the library setting">
          <Switch
            label="Force export"
            color="red"
            checked={row.forceInclude === true}
            onChange={(event) => onForceIncludeChange(row, event.currentTarget.checked)}
            aria-label={`Force export ${row.displayLabel} as its own zone`}
          />
        </Tooltip>
      ) : (
        <Switch
          label="Skip from export"
          checked={row.excluded}
          onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
          aria-label={`Skip ${row.displayLabel} from export`}
        />
      )}
      <OverrideField
        label="Wire name"
        overridden={row.hasWireNameOverride}
        onReset={() => onWireNameChange(row, '')}
        libraryHint={`Suggestion: ${row.generatedWireName}`}
      >
        <Stack gap={4}>
          <WireNameRemediationMarker
            remediation={row.remediation}
            originalName={row.displayLabel}
            limit={nameLimit}
          />
          <WireNameInlineEditor
            key={`${row.key}:${row.hasWireNameOverride}:${row.effectiveWireName}`}
            committedValue={wireNameCommittedValue(row)}
            suggestions={[{ value: row.generatedWireName }]}
            limit={nameLimit}
            disabled={!effectivelyIncluded}
            onCommit={(value) => onWireNameChange(row, value)}
          />
        </Stack>
      </OverrideField>
    </Stack>
  );
}
