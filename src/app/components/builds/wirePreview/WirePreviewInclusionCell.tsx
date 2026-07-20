import { Group, Switch, Tooltip } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

export interface WirePreviewInclusionCellProps {
  row: WirePreviewRow;
  disabled?: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
}

/**
 * Dense list control for build export include/skip.
 * Library nested-only zones get **Force export** (red when on); other rows get **Skip from export**.
 */
export default function WirePreviewInclusionCell({
  row,
  disabled = false,
  onExcludedChange,
  onForceIncludeChange,
}: WirePreviewInclusionCellProps) {
  const libraryOmit = row.omitFromExport === true;
  const showForce = libraryOmit && onForceIncludeChange != null;

  if (showForce) {
    return (
      <Group gap="xs" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
        <Tooltip label="Export this zone as its own row in this build, despite the library setting">
          <Switch
            size="xs"
            label="Force export"
            color="red"
            checked={row.forceInclude === true}
            disabled={disabled}
            onChange={(event) => onForceIncludeChange(row, event.currentTarget.checked)}
            aria-label={`Force export ${row.displayLabel} as its own zone`}
          />
        </Tooltip>
        {row.forceInclude ? (
          <Switch
            size="xs"
            label="Skip"
            checked={row.excluded}
            disabled={disabled}
            onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
            aria-label={`Skip ${row.displayLabel} from export`}
          />
        ) : null}
      </Group>
    );
  }

  return (
    <Group gap="xs" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <Switch
        size="xs"
        label="Skip from export"
        checked={row.excluded}
        disabled={disabled}
        onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
        aria-label={`Skip ${row.displayLabel} from export`}
      />
    </Group>
  );
}
