import { NumberInput, Select } from '@mantine/core';
import type { DMRTimeSlot } from '@core/models/library.ts';
import type { ProfileFor } from './types.ts';
import type { ModePanelProps } from './types.ts';
import { type ChannelTimeslot } from '../../../lib/channelFields/index.ts';
import BrandmeisterRxListSyncAction from '../../repeaters/BrandmeisterRxListSyncAction.tsx';
import RxGroupListSummary from '../../library/RxGroupListSummary.tsx';
import SendTalkerAliasSegment from '../SendTalkerAliasSegment.tsx';
import DmrOperatingModeSegment from '../DmrOperatingModeSegment.tsx';
import DigitalModeGroups, { TwoUp } from './DigitalModeGroups.tsx';
import OwnDigitalIdSelect from './OwnDigitalIdSelect.tsx';

const timeslotSelectData = [
  { value: '', label: '—' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];

export default function DmrModePanel({
  profile,
  onPatch,
  context,
}: ModePanelProps<ProfileFor<'dmr'>>) {
  const { library, savedChannel, rxFrequency, txFrequency, compact } = context;

  const contactOptions = [
    { value: '', label: 'None' },
    ...library.digitalContacts.map((c) => ({ value: c.id, label: c.name })),
    ...library.talkGroups
      .filter((t) => t.mode === 'dmr')
      .map((t) => ({ value: `tg:${t.id}`, label: `${t.name} (group)` })),
  ];

  const contactValue =
    profile.contactRef?.kind === 'digitalContact'
      ? profile.contactRef.id
      : profile.contactRef?.kind === 'talkGroup'
        ? `tg:${profile.contactRef.id}`
        : '';

  return (
    <DigitalModeGroups
      access={
        <>
          <TwoUp compact={compact}>
            <NumberInput
              label="Colour code"
              value={profile.colourCode ?? undefined}
              onChange={(v) => onPatch({ colourCode: typeof v === 'number' ? v : null })}
              min={0}
              max={15}
              allowDecimal={false}
            />
            <Select
              label="Timeslot"
              data={timeslotSelectData}
              value={profile.timeslot != null ? String(profile.timeslot) : ''}
              onChange={(v) => {
                const ts: ChannelTimeslot | null = v === '1' ? 1 : v === '2' ? 2 : null;
                onPatch({ timeslot: ts as DMRTimeSlot | null });
              }}
              clearable
            />
          </TwoUp>
          <DmrOperatingModeSegment
            value={profile.dmrMode ?? null}
            onChange={(dmrMode) => onPatch({ dmrMode })}
            rxFrequency={rxFrequency}
            txFrequency={txFrequency}
            layout="row"
          />
        </>
      }
      call={
        <Select
          label="Talk group or contact"
          data={contactOptions}
          value={contactValue}
          onChange={(v) => {
            if (!v) {
              onPatch({ contactRef: null });
              return;
            }
            if (v.startsWith('tg:')) {
              onPatch({ contactRef: { kind: 'talkGroup', id: v.slice(3) } });
            } else {
              onPatch({ contactRef: { kind: 'digitalContact', id: v } });
            }
          }}
          searchable
          clearable
        />
      }
      listen={
        <>
          <Select
            label="RX group list"
            data={[
              { value: '', label: 'None' },
              ...library.rxGroupLists.map((r) => ({ value: r.id, label: r.name })),
            ]}
            value={profile.rxGroupListId ?? ''}
            onChange={(v) => onPatch({ rxGroupListId: v || null })}
            searchable
            clearable
          />
          <RxGroupListSummary listId={profile.rxGroupListId} library={library} />
          {savedChannel ? (
            <BrandmeisterRxListSyncAction channel={savedChannel} library={library} />
          ) : null}
        </>
      }
      you={
        <>
          <OwnDigitalIdSelect
            label="DMR ID"
            protocol="dmr"
            library={library}
            value={profile.ownDigitalIdId}
            onChange={(ownDigitalIdId) => onPatch({ ownDigitalIdId })}
          />
          <SendTalkerAliasSegment
            value={profile.sendTalkerAlias ?? 'default'}
            onChange={(sendTalkerAlias) => onPatch({ sendTalkerAlias })}
            layout="row"
          />
        </>
      }
    />
  );
}
