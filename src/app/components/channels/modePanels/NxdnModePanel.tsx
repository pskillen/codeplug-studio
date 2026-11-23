import { NumberInput, Select } from '@mantine/core';
import {
  NXDN_FIELD_HINTS,
  NXDN_FIELD_LABELS,
  NXDN_RATE_DEFAULT_VALUE,
  NXDN_RATE_OPTIONS,
  nxdnCallFromSelectValue,
  nxdnCallOptions,
  nxdnCallValue,
  nxdnRateFromSelectValue,
  nxdnRxGroupListOptions,
} from '../../../lib/nxdnProfileFields.ts';
import type { ProfileFor } from './types.ts';
import type { ModePanelProps } from './types.ts';
import DigitalModeGroups, { TwoUp } from './DigitalModeGroups.tsx';
import OwnDigitalIdSelect from './OwnDigitalIdSelect.tsx';

export default function NxdnModePanel({
  profile,
  onPatch,
  context,
}: ModePanelProps<ProfileFor<'nxdn'>>) {
  const { library, compact } = context;

  return (
    <DigitalModeGroups
      access={
        <>
          <TwoUp compact={compact}>
            <NumberInput
              label={NXDN_FIELD_LABELS.rxRan}
              value={profile.rxRan ?? undefined}
              onChange={(v) => onPatch({ rxRan: typeof v === 'number' ? v : null })}
              min={0}
              max={63}
              allowDecimal={false}
            />
            <NumberInput
              label={NXDN_FIELD_LABELS.txRan}
              value={profile.txRan ?? undefined}
              onChange={(v) => onPatch({ txRan: typeof v === 'number' ? v : null })}
              min={0}
              max={63}
              allowDecimal={false}
            />
          </TwoUp>
          <Select
            label={NXDN_FIELD_LABELS.rate}
            description={NXDN_FIELD_HINTS.rate}
            data={[...NXDN_RATE_OPTIONS]}
            value={profile.nxdnRate ?? NXDN_RATE_DEFAULT_VALUE}
            onChange={(v) => onPatch({ nxdnRate: nxdnRateFromSelectValue(v) })}
            allowDeselect={false}
          />
        </>
      }
      call={
        <Select
          label={NXDN_FIELD_LABELS.call}
          description={NXDN_FIELD_HINTS.call}
          data={nxdnCallOptions(library)}
          value={nxdnCallValue(profile.contactRef)}
          onChange={(v) => onPatch({ contactRef: nxdnCallFromSelectValue(v) })}
          searchable
          clearable
        />
      }
      listen={
        <Select
          label={NXDN_FIELD_LABELS.rxGroupList}
          description={NXDN_FIELD_HINTS.rxGroupList}
          data={nxdnRxGroupListOptions(library, profile.rxGroupListId)}
          value={profile.rxGroupListId ?? ''}
          onChange={(v) => onPatch({ rxGroupListId: v || null })}
          searchable
          clearable
        />
      }
      you={
        <OwnDigitalIdSelect
          label={NXDN_FIELD_LABELS.unitId}
          protocol="nxdn"
          library={library}
          value={profile.ownDigitalIdId}
          onChange={(ownDigitalIdId) => onPatch({ ownDigitalIdId })}
        />
      }
    />
  );
}