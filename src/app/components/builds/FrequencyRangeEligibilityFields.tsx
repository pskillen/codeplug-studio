import { Switch } from '@mantine/core';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import { FieldCard } from '../fields/Fields.tsx';

export interface FrequencyRangeEligibilityFieldsProps {
  hideOutsideFrequencyRange: boolean;
  saving: boolean;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
}

export default function FrequencyRangeEligibilityFields({
  hideOutsideFrequencyRange,
  saving,
  onPatch,
}: FrequencyRangeEligibilityFieldsProps) {
  return (
    <FieldCard
      title="Channel eligibility"
      description="Which library channels appear on Radio Build pages and are included in export."
    >
      <Switch
        label="Hide channels outside frequency range"
        description="When on (default), channels outside this radio's supported bands are hidden on build pages and omitted from export. Unsupported modes are always hidden."
        checked={hideOutsideFrequencyRange}
        disabled={saving}
        onChange={(event) =>
          onPatch({ hideChannelsOutsideFrequencyRange: event.currentTarget.checked })
        }
      />
    </FieldCard>
  );
}
