import { NumberInput, Select } from '@mantine/core';
import type { ProfileFor } from './types.ts';
import type { ModePanelProps } from './types.ts';
import DigitalModeGroups, { TwoUp } from './DigitalModeGroups.tsx';

export default function TetraModePanel({
  profile,
  onPatch,
  context,
}: ModePanelProps<ProfileFor<'tetra'>>) {
  const { library, compact } = context;

  return (
    <DigitalModeGroups
      access={
        <>
          <TwoUp compact={compact}>
            <NumberInput
              label="MCC"
              value={profile.mcc ?? undefined}
              onChange={(v) => onPatch({ mcc: typeof v === 'number' ? v : null })}
              min={0}
              allowDecimal={false}
            />
            <NumberInput
              label="MNC"
              value={profile.mnc ?? undefined}
              onChange={(v) => onPatch({ mnc: typeof v === 'number' ? v : null })}
              min={0}
              allowDecimal={false}
            />
          </TwoUp>
          <NumberInput
            label="Colour code"
            value={profile.colorCode ?? undefined}
            onChange={(v) => onPatch({ colorCode: typeof v === 'number' ? v : null })}
            min={0}
            max={15}
            allowDecimal={false}
          />
        </>
      }
      call={
        <>
          <Select
            label="Talk group"
            data={[
              { value: '', label: 'None' },
              ...library.talkGroups
                .filter((t) => t.mode === 'tetra')
                .map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={profile.talkGroupRef?.id ?? ''}
            onChange={(v) => onPatch({ talkGroupRef: v ? { kind: 'talkGroup', id: v } : null })}
            searchable
            clearable
          />
          <NumberInput
            label="GSSI"
            value={profile.gssi ?? undefined}
            onChange={(v) => onPatch({ gssi: typeof v === 'number' ? v : null })}
            min={0}
            allowDecimal={false}
          />
        </>
      }
      listen={{ note: 'Hears its talk group.' }}
      you={{ note: 'Your ISSI is set on the radio.' }}
    />
  );
}