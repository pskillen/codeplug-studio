import { Group, NumberInput, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import type {
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelModeProfileDstar,
  ChannelModeProfileNxdn,
  ChannelModeProfileTetra,
  ChannelModeProfileYsf,
  ChannelTone,
  DMRTimeSlot,
  Library,
} from '@core/models/library.ts';
import { isAnalogChannelModeProfile, isModeOnlyStub } from '@core/domain/modeProfiles.ts';
import ModePill from '../pills/ModePill.tsx';
import { PercentLevelSlider } from '../ui/index.ts';
import {
  BANDWIDTH_KHZ_OPTIONS,
  toneSelectOptions,
  type ChannelTimeslot,
} from '../../lib/channelFields/index.ts';
import { isDmrMode, modeLabel } from '../../lib/channelModes.ts';

const bandwidthSelectData = [
  { value: '', label: '—' },
  ...BANDWIDTH_KHZ_OPTIONS.map((bw) => ({ value: String(bw), label: `${bw} kHz` })),
];

const timeslotSelectData = [
  { value: '', label: '—' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
];

export interface ChannelModeProfilesEditorProps {
  profiles: ChannelModeProfile[];
  library: Library;
  onChange: (profiles: ChannelModeProfile[]) => void;
}

export default function ChannelModeProfilesEditor({
  profiles,
  library,
  onChange,
}: ChannelModeProfilesEditorProps) {
  const updateProfile = (index: number, patch: Partial<ChannelModeProfile>) => {
    onChange(
      profiles.map((p, i) => (i === index ? ({ ...p, ...patch } as ChannelModeProfile) : p)),
    );
  };

  if (profiles.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Select at least one mode above to configure mode-specific settings.
      </Text>
    );
  }

  return (
    <Tabs defaultValue={profiles[0]?.mode ?? 'fm'}>
      <Tabs.List>
        {profiles.map((p) => (
          <Tabs.Tab key={p.mode} value={p.mode}>
            <Group gap={6}>
              <ModePill mode={p.mode} size="xs" />
              {modeLabel(p.mode)}
            </Group>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {profiles.map((profile, index) => (
        <Tabs.Panel key={profile.mode} value={profile.mode} pt="md">
          <Stack gap="sm">
            {isAnalogChannelModeProfile(profile) ? (
              <AnalogPanel profile={profile} onPatch={(patch) => updateProfile(index, patch)} />
            ) : null}
            {isDmrMode(profile.mode) ? (
              <DmrPanel
                profile={profile as ChannelModeProfileDMR}
                library={library}
                onPatch={(patch) => updateProfile(index, patch)}
              />
            ) : null}
            {profile.mode === 'dstar' ? (
              <DstarPanel
                profile={profile as ChannelModeProfileDstar}
                onPatch={(patch) => updateProfile(index, patch)}
              />
            ) : null}
            {profile.mode === 'ysf' ? (
              <YsfPanel
                profile={profile as ChannelModeProfileYsf}
                onPatch={(patch) => updateProfile(index, patch)}
              />
            ) : null}
            {profile.mode === 'nxdn' ? (
              <NxdnPanel
                profile={profile as ChannelModeProfileNxdn}
                library={library}
                onPatch={(patch) => updateProfile(index, patch)}
              />
            ) : null}
            {profile.mode === 'tetra' ? (
              <TetraPanel
                profile={profile as ChannelModeProfileTetra}
                library={library}
                onPatch={(patch) => updateProfile(index, patch)}
              />
            ) : null}
            {isModeOnlyStub(profile) ? (
              <Text size="sm" c="dimmed">
                No additional fields for this mode yet.
              </Text>
            ) : null}
          </Stack>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function AnalogPanel({
  profile,
  onPatch,
}: {
  profile: ChannelModeProfileAnalog;
  onPatch: (patch: Partial<ChannelModeProfileAnalog>) => void;
}) {
  return (
    <>
      <Select
        label="Bandwidth (kHz)"
        data={bandwidthSelectData}
        value={profile.bandwidthKHz != null ? String(profile.bandwidthKHz) : ''}
        onChange={(v) => onPatch({ bandwidthKHz: v && v !== '' ? parseFloat(v) : null })}
        clearable
      />
      <Group grow>
        <Select
          label="RX tone"
          data={toneSelectOptions()}
          value={profile.rxTone}
          onChange={(v) => onPatch({ rxTone: (v ?? 'none') as ChannelTone })}
          searchable
        />
        <Select
          label="TX tone"
          data={toneSelectOptions()}
          value={profile.txTone}
          onChange={(v) => onPatch({ txTone: (v ?? 'none') as ChannelTone })}
          searchable
        />
      </Group>
      <PercentLevelSlider
        label="Squelch"
        value={profile.squelch}
        onChange={(v) => onPatch({ squelch: v })}
        zeroLabel="Open (0%)"
      />
    </>
  );
}

function DmrPanel({
  profile,
  library,
  onPatch,
}: {
  profile: ChannelModeProfileDMR;
  library: Library;
  onPatch: (patch: Partial<ChannelModeProfileDMR>) => void;
}) {
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
    <>
      <Group grow>
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
      </Group>
      <NumberInput
        label="DMR ID"
        value={profile.dmrId ?? undefined}
        onChange={(v) => onPatch({ dmrId: typeof v === 'number' && v > 0 ? v : null })}
        min={1}
        allowDecimal={false}
      />
      <Select
        label="TX contact"
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
    </>
  );
}

function DstarPanel({
  profile,
  onPatch,
}: {
  profile: ChannelModeProfileDstar;
  onPatch: (patch: Partial<ChannelModeProfileDstar>) => void;
}) {
  return (
    <>
      <TextInput
        label="UR call"
        description="Destination (e.g. CQCQCQ)"
        value={profile.urCall}
        onChange={(e) => onPatch({ urCall: e.currentTarget.value })}
      />
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
  );
}

function YsfPanel({
  profile,
  onPatch,
}: {
  profile: ChannelModeProfileYsf;
  onPatch: (patch: Partial<ChannelModeProfileYsf>) => void;
}) {
  return (
    <>
      <NumberInput
        label="DG-ID"
        description="WIRES-X digital group ID (0–99)"
        value={profile.dgId ?? undefined}
        onChange={(v) => onPatch({ dgId: typeof v === 'number' ? v : null })}
        min={0}
        max={99}
        allowDecimal={false}
      />
      <TextInput
        label="WIRES-X DTMF ID"
        description="Optional 5-digit ID for analog nodes"
        value={profile.wiresDtmfId}
        onChange={(e) => onPatch({ wiresDtmfId: e.currentTarget.value })}
      />
    </>
  );
}

function NxdnPanel({
  profile,
  library,
  onPatch,
}: {
  profile: ChannelModeProfileNxdn;
  library: Library;
  onPatch: (patch: Partial<ChannelModeProfileNxdn>) => void;
}) {
  return (
    <>
      <Group grow>
        <NumberInput
          label="RX RAN"
          value={profile.rxRan ?? undefined}
          onChange={(v) => onPatch({ rxRan: typeof v === 'number' ? v : null })}
          min={0}
          max={63}
          allowDecimal={false}
        />
        <NumberInput
          label="TX RAN"
          value={profile.txRan ?? undefined}
          onChange={(v) => onPatch({ txRan: typeof v === 'number' ? v : null })}
          min={0}
          max={63}
          allowDecimal={false}
        />
      </Group>
      <NumberInput
        label="Unit ID"
        value={profile.unitId ?? undefined}
        onChange={(v) => onPatch({ unitId: typeof v === 'number' ? v : null })}
        min={1}
        allowDecimal={false}
      />
      <Select
        label="Talk group"
        data={[
          { value: '', label: 'None' },
          ...library.talkGroups
            .filter((t) => t.mode === 'nxdn')
            .map((t) => ({ value: t.id, label: t.name })),
        ]}
        value={profile.talkGroupRef?.id ?? ''}
        onChange={(v) => onPatch({ talkGroupRef: v ? { kind: 'talkGroup', id: v } : null })}
        searchable
        clearable
      />
    </>
  );
}

function TetraPanel({
  profile,
  library,
  onPatch,
}: {
  profile: ChannelModeProfileTetra;
  library: Library;
  onPatch: (patch: Partial<ChannelModeProfileTetra>) => void;
}) {
  return (
    <>
      <Group grow>
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
      </Group>
      <NumberInput
        label="GSSI"
        value={profile.gssi ?? undefined}
        onChange={(v) => onPatch({ gssi: typeof v === 'number' ? v : null })}
        min={0}
        allowDecimal={false}
      />
      <NumberInput
        label="Color code"
        value={profile.colorCode ?? undefined}
        onChange={(v) => onPatch({ colorCode: typeof v === 'number' ? v : null })}
        min={0}
        max={15}
        allowDecimal={false}
      />
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
    </>
  );
}
