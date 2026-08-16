import { Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { WireNameRemediation } from '@core/services/resolveWireNames.ts';
import { ICON_STROKE } from '../../../lib/iconSizes.ts';

export interface WireNameRemediationMarkerProps {
  remediation?: WireNameRemediation;
  /** Library/original name — used in the `shortened` tooltip. */
  originalName?: string;
  limit?: number;
}

/**
 * Read-state severity marker for a wire-preview row, driven by the resolver's
 * `remediation` field (ux-proposal.md §2) — not a `nameTruncated` boolean. Clean
 * shortening and disambiguation stay quiet (dimmed); only `truncated`/`over_limit`
 * (information genuinely lost, uncontrolled by the operator) get the orange triangle.
 */
export default function WireNameRemediationMarker({
  remediation,
  originalName,
  limit,
}: WireNameRemediationMarkerProps) {
  if (!remediation || remediation === 'none') return null;

  switch (remediation) {
    case 'shortened':
      return (
        <Tooltip
          label={
            limit != null
              ? `Shortened from ${originalName ?? 'the library name'} to fit ${limit} characters.`
              : `Shortened from ${originalName ?? 'the library name'}.`
          }
        >
          <Text span size="xs" c="dimmed" aria-label="Name shortened">
            ≈
          </Text>
        </Tooltip>
      );
    case 'disambiguated':
      return (
        <Tooltip label="Another item wanted this name, so this one uses the exported name shown.">
          <Text span size="xs" c="dimmed" aria-label="Name disambiguated">
            ≈
          </Text>
        </Tooltip>
      );
    case 'truncated':
      return (
        <Tooltip
          label={
            limit != null
              ? `Cut to ${limit} characters. Change the name to control what's kept.`
              : "Cut to fit the export limit. Change the name to control what's kept."
          }
        >
          <IconAlertTriangle
            size={14}
            stroke={ICON_STROKE}
            color="var(--mantine-color-orange-6)"
            aria-label="Name truncated"
          />
        </Tooltip>
      );
    case 'over_limit':
      return (
        <Tooltip
          label={
            limit != null
              ? `Still longer than ${limit} characters. The radio will cut it.`
              : 'Still longer than the export limit. The radio will cut it.'
          }
        >
          <IconAlertTriangle
            size={14}
            stroke={ICON_STROKE}
            color="var(--mantine-color-orange-6)"
            aria-label="Name over limit"
          />
        </Tooltip>
      );
  }
}
