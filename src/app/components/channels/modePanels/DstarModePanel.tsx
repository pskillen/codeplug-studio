import { TextInput } from '@mantine/core';
import type { ProfileFor } from './types.ts';
import type { ModePanelProps } from './types.ts';
import DigitalModeGroups from './DigitalModeGroups.tsx';

export default function DstarModePanel({ profile, onPatch }: ModePanelProps<ProfileFor<'dstar'>>) {
  return (
    <DigitalModeGroups
      access={
        <>
          <TextInput
            label="RPT1 call"
            description="Local repeater + module"
            value={profile.rpt1Call}
            onChange={(e) => onPatch({ rpt1Call: e.currentTarget.value })}
          />
          <TextInput
            label="RPT2 call"
            description="Gateway path (often repeater + G)"
            value={profile.rpt2Call}
            onChange={(e) => onPatch({ rpt2Call: e.currentTarget.value })}
          />
        </>
      }
      call={
        <TextInput
          label="UR call"
          description="Destination (e.g. CQCQCQ)"
          value={profile.urCall}
          onChange={(e) => onPatch({ urCall: e.currentTarget.value })}
        />
      }
      listen={{ note: 'Hears every call through the repeater.' }}
      you={{ note: 'Your callsign is set on the radio.' }}
    />
  );
}
