import { NumberInput, TextInput } from '@mantine/core';
import type { ProfileFor } from './types.ts';
import type { ModePanelProps } from './types.ts';
import DigitalModeGroups from './DigitalModeGroups.tsx';

export default function YsfModePanel({ profile, onPatch }: ModePanelProps<ProfileFor<'ysf'>>) {
  return (
    <DigitalModeGroups
      access={
        <NumberInput
          label="DG-ID"
          description="WIRES-X digital group ID (0–99)"
          value={profile.dgId ?? undefined}
          onChange={(v) => onPatch({ dgId: typeof v === 'number' ? v : null })}
          min={0}
          max={99}
          allowDecimal={false}
        />
      }
      call={
        <TextInput
          label="WIRES-X DTMF ID"
          description="Optional 5-digit ID for analog nodes"
          value={profile.wiresDtmfId}
          onChange={(e) => onPatch({ wiresDtmfId: e.currentTarget.value })}
        />
      }
      listen={{ note: 'Hears calls with the same DG-ID.' }}
      you={{ note: 'Your callsign is set on the radio.' }}
    />
  );
}
