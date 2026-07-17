import { Stack, Switch } from '@mantine/core';
import type { BuildExportSettings } from '@core/models/formatBuild.ts';

export interface ZoneBehaviourExportOverridesProps {
  exportSettings: BuildExportSettings | undefined;
  disabled?: boolean;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
}

/** Build-wide override for zone-derived scan membership (orthogonal to defaultScanInclusion). */
export default function ZoneBehaviourExportOverrides({
  exportSettings,
  disabled = false,
  onPatch,
}: ZoneBehaviourExportOverridesProps) {
  const overrideEnabled = exportSettings?.defaultIncludeInZoneDerivedScanList !== undefined;
  const includeValue = exportSettings?.defaultIncludeInZoneDerivedScanList ?? true;

  return (
    <Stack gap="xs">
      <Switch
        label="Override zone-derived scan membership default"
        description="When enabled, wins over library zone defaults and per-member Default overrides for zone-derived scan lists. Does not change channel Skip / scanInclusion."
        checked={overrideEnabled}
        disabled={disabled}
        onChange={(event) =>
          onPatch({
            defaultIncludeInZoneDerivedScanList: event.currentTarget.checked
              ? includeValue
              : undefined,
          })
        }
      />
      <Switch
        label="Include members in zone-derived scan lists"
        description="Build-wide default when the override above is on."
        checked={includeValue}
        disabled={disabled || !overrideEnabled}
        onChange={(event) =>
          onPatch({ defaultIncludeInZoneDerivedScanList: event.currentTarget.checked })
        }
      />
    </Stack>
  );
}
