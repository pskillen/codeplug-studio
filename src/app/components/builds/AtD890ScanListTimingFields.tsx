import { NumberInput, Text } from '@mantine/core';
import { useCallback } from 'react';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import { AT_D890_SCAN_TIMING_SECONDS_CSV } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { useDebouncedOptionalNumberField } from '../../hooks/useDebouncedOptionalNumberField.ts';
import ExportSettingsSubheading from './ExportSettingsSubheading.tsx';

type ScanListTimingField =
  | 'scanListLookBackASeconds'
  | 'scanListLookBackBSeconds'
  | 'scanListDropoutDelaySeconds'
  | 'scanListDwellTimeSeconds';

export interface AtD890ScanListTimingFieldsProps {
  exportSettings?: BuildExportSettings;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
}

function useScanTimingField(
  exportSettings: BuildExportSettings | undefined,
  field: ScanListTimingField,
  onPatch: (patch: Partial<BuildExportSettings>) => void,
) {
  const commit = useCallback(
    (value: number | undefined) => {
      const stored = exportSettings?.[field];
      if (value === undefined) {
        if (stored !== undefined) {
          onPatch({ [field]: undefined });
        }
        return;
      }
      if (stored === value) return;
      onPatch({ [field]: value });
    },
    [exportSettings, field, onPatch],
  );

  return useDebouncedOptionalNumberField(exportSettings?.[field], commit);
}

export default function AtD890ScanListTimingFields({
  exportSettings,
  onPatch,
}: AtD890ScanListTimingFieldsProps) {
  const lookBackA = useScanTimingField(exportSettings, 'scanListLookBackASeconds', onPatch);
  const lookBackB = useScanTimingField(exportSettings, 'scanListLookBackBSeconds', onPatch);
  const dropoutDelay = useScanTimingField(exportSettings, 'scanListDropoutDelaySeconds', onPatch);
  const dwellTime = useScanTimingField(exportSettings, 'scanListDwellTimeSeconds', onPatch);

  return (
    <>
      <ExportSettingsSubheading>Scan list timing</ExportSettingsSubheading>
      <Text size="sm" c="dimmed">
        Applied to every library and zone-derived scan list on export. Empty fields use{' '}
        {AT_D890_SCAN_TIMING_SECONDS_CSV} s.
      </Text>
      <NumberInput
        label="Look Back Time A[s]"
        description="Priority sample interval A (0.5–5.0 s)"
        decimalScale={1}
        step={0.1}
        min={0.5}
        max={5}
        value={lookBackA.value}
        placeholder={AT_D890_SCAN_TIMING_SECONDS_CSV}
        onChange={lookBackA.setValue}
        onBlur={lookBackA.flush}
      />
      <NumberInput
        label="Look Back Time B[s]"
        description="Priority sample interval B (0.5–5.0 s)"
        decimalScale={1}
        step={0.1}
        min={0.5}
        max={5}
        value={lookBackB.value}
        placeholder={AT_D890_SCAN_TIMING_SECONDS_CSV}
        onChange={lookBackB.setValue}
        onBlur={lookBackB.flush}
      />
      <NumberInput
        label="Dropout Delay Time[s]"
        description="Post-reply resume delay (0.1–5.0 s)"
        decimalScale={1}
        step={0.1}
        min={0.1}
        max={5}
        value={dropoutDelay.value}
        placeholder={AT_D890_SCAN_TIMING_SECONDS_CSV}
        onChange={dropoutDelay.setValue}
        onBlur={dropoutDelay.flush}
      />
      <NumberInput
        label="Dwell Time[s]"
        description="Post-transmit resume delay (0.1–5.0 s)"
        decimalScale={1}
        step={0.1}
        min={0.1}
        max={5}
        value={dwellTime.value}
        placeholder={AT_D890_SCAN_TIMING_SECONDS_CSV}
        onChange={dwellTime.setValue}
        onBlur={dwellTime.flush}
      />
    </>
  );
}
