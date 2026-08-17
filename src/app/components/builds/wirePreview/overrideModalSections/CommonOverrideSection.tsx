import { Stack, Switch, Text, Tooltip } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { findZoneGroupingSection } from '@core/domain/zoneGroupingLayout.ts';
import { OverrideField } from '../../../v2/index.ts';
import WireNameInlineEditor from '../WireNameInlineEditor.tsx';
import WireNameRemediationMarker from '../WireNameRemediationMarker.tsx';
import WireResolutionSection from '../WireResolutionSection.tsx';
import {
  channelWireResolutionRows,
  zoneDerivedScanResolutionRows,
  zoneWireResolutionRows,
} from '../../../../lib/wirePreviewResolution.ts';
import { rowEffectivelyIncluded, wireNameCommittedValue } from '../wirePreviewRowUtils.ts';

export interface CommonOverrideSectionProps {
  row: WirePreviewRow;
  nameLimit?: number;
  showForceInclude: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  /** Build + library — when both are available, renders a Resolution section below the name. */
  build?: FormatBuild;
  library?: LibrarySlice | null;
}

export default function CommonOverrideSection({
  row,
  nameLimit,
  showForceInclude,
  onExcludedChange,
  onForceIncludeChange,
  onWireNameChange,
  build,
  library,
}: CommonOverrideSectionProps) {
  const effectivelyIncluded = rowEffectivelyIncluded(row);
  const skippedByLibrary = row.omitFromExport === true;

  const resolution = (() => {
    if (!build || !library) return null;
    if (row.entityKind === 'channel') {
      const channel = library.channels.find((entry) => entry.id === row.libraryEntityId);
      if (!channel) return null;
      return { fields: channelWireResolutionRows(channel, row, build, library) };
    }
    if (row.entityKind === 'zone') {
      const zone = library.zones.find((entry) => entry.id === row.libraryEntityId);
      if (!zone) return null;
      return {
        fields: zoneWireResolutionRows(row),
        zoneDerivedScan: zoneDerivedScanResolutionRows(
          zone,
          build,
          library,
          findZoneGroupingSection(build),
        ),
      };
    }
    return null;
  })();

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
      {resolution ? (
        <WireResolutionSection
          fields={resolution.fields}
          zoneDerivedScan={resolution.zoneDerivedScan}
        />
      ) : null}
    </Stack>
  );
}
