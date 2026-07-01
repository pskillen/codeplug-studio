import { useState } from 'react';
import { Alert, Button, Checkbox, Group, Select, Stack, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  DMRTimeSlot,
  Library,
} from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import RepeaterVerifyPanel from '../../components/repeaters/RepeaterVerifyPanel.tsx';
import { FormSection } from '../../components/ui/index.ts';
import { hzToMhzString, mhzStringToHz, parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';

type Mode = 'fm' | 'dmr';

function firstProfileMode(channel: Channel | null): Mode {
  return channel?.modeProfiles[0]?.mode === 'dmr' ? 'dmr' : 'fm';
}

export default function ChannelEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: Channel | null;
  library: Library;
}) {
  const base = entity ?? newChannel(projectId, '');
  const fm =
    (entity?.modeProfiles.find((p) => p.mode !== 'dmr') as ChannelModeProfileAnalog | undefined) ??
    null;
  const dmr =
    (entity?.modeProfiles.find((p) => p.mode === 'dmr') as ChannelModeProfileDMR | undefined) ??
    null;

  const [name, setName] = useState(base.name);
  const [callsign, setCallsign] = useState(base.callsign);
  const [rx, setRx] = useState(hzToMhzString(base.rxFrequency));
  const [tx, setTx] = useState(hzToMhzString(base.txFrequency));
  const [power, setPower] = useState(base.power === null ? '' : String(base.power));
  const [scanSkip, setScanSkip] = useState(base.scanSkip);
  const [comment, setComment] = useState(base.comment);

  const [mode, setMode] = useState<Mode>(firstProfileMode(entity));
  const [squelch, setSquelch] = useState(fm?.squelch == null ? '' : String(fm.squelch));
  const [rxTone, setRxTone] = useState(fm?.rxTone ?? 'none');
  const [txTone, setTxTone] = useState(fm?.txTone ?? 'none');
  const [colourCode, setColourCode] = useState(
    dmr?.colourCode == null ? '' : String(dmr.colourCode),
  );
  const [timeslot, setTimeslot] = useState<string>(dmr?.timeslot ? String(dmr.timeslot) : '');
  const [dmrId, setDmrId] = useState(dmr?.dmrId == null ? '' : String(dmr.dmrId));
  const [contactId, setContactId] = useState(
    dmr?.contactRef?.kind === 'digitalContact' ? dmr.contactRef.id : '',
  );
  const [rxGroupListId, setRxGroupListId] = useState(dmr?.rxGroupListId ?? '');

  const { save, saving, error } = useEntitySave('channels');

  function buildRow(): Channel {
    const profile: ChannelModeProfileAnalog | ChannelModeProfileDMR =
      mode === 'fm'
        ? { mode: 'fm', squelch: parseOptionalInt(squelch), rxTone, txTone, bandwidthKHz: null }
        : {
            mode: 'dmr',
            colourCode: parseOptionalInt(colourCode),
            timeslot: timeslot === '' ? null : (Number(timeslot) as DMRTimeSlot),
            dmrId: parseOptionalInt(dmrId),
            contactRef: contactId ? { kind: 'digitalContact', id: contactId } : null,
            rxGroupListId: rxGroupListId || null,
          };
    return {
      ...base,
      name: name.trim() || 'Untitled channel',
      callsign,
      rxFrequency: mhzStringToHz(rx),
      txFrequency: mhzStringToHz(tx),
      power: parseOptionalInt(power),
      scanSkip,
      comment,
      maidenheadLocator: base.maidenheadLocator ?? null,
      modeProfiles: [profile],
    };
  }

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putChannel(row, entity ? entity.revision : null));
  }

  const liveChannel = buildRow();

  return (
    <Stack gap="lg" maw={520}>
      {!entity ? (
        <Alert color="blue" variant="light">
          Prefer importing from a directory? Use{' '}
          <Link to="/library/channels/add-from-ukrepeater">ukrepeater.net</Link> or{' '}
          <Link to="/library/channels/add-from-brandmeister">BrandMeister</Link> in the section nav.
        </Alert>
      ) : null}

      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput
          label="Callsign"
          value={callsign}
          onChange={(e) => setCallsign(e.currentTarget.value)}
        />
      </FormSection>

      <FormSection title="Frequencies">
        <TextInput
          label="RX frequency (MHz)"
          value={rx}
          onChange={(e) => setRx(e.currentTarget.value)}
        />
        <TextInput
          label="TX frequency (MHz)"
          value={tx}
          onChange={(e) => setTx(e.currentTarget.value)}
        />
        <TextInput
          label="Power (%)"
          description="Blank = radio default"
          value={power}
          onChange={(e) => setPower(e.currentTarget.value)}
        />
      </FormSection>

      <FormSection title="Notes">
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Checkbox
          label="Skip on scan"
          checked={scanSkip}
          onChange={(e) => setScanSkip(e.currentTarget.checked)}
        />
      </FormSection>

      <FormSection title="Mode">
        <Select
          label="Mode"
          data={[
            { value: 'fm', label: 'FM (analogue)' },
            { value: 'dmr', label: 'DMR (digital)' },
          ]}
          value={mode}
          onChange={(v) => setMode((v as Mode) ?? 'fm')}
        />
      </FormSection>

      {mode === 'fm' ? (
        <FormSection title="FM">
          <TextInput
            label="Squelch"
            description="Blank = default"
            value={squelch}
            onChange={(e) => setSquelch(e.currentTarget.value)}
          />
          <TextInput
            label="RX tone"
            value={rxTone}
            onChange={(e) => setRxTone(e.currentTarget.value)}
          />
          <TextInput
            label="TX tone"
            value={txTone}
            onChange={(e) => setTxTone(e.currentTarget.value)}
          />
        </FormSection>
      ) : (
        <FormSection title="DMR">
          <TextInput
            label="Colour code"
            value={colourCode}
            onChange={(e) => setColourCode(e.currentTarget.value)}
          />
          <Select
            label="Timeslot"
            data={[
              { value: '', label: '—' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
            ]}
            value={timeslot}
            onChange={(v) => setTimeslot(v ?? '')}
          />
          <TextInput
            label="DMR ID"
            value={dmrId}
            onChange={(e) => setDmrId(e.currentTarget.value)}
          />
          <Select
            label="Digital contact"
            description="UUID reference"
            data={[
              { value: '', label: '— none —' },
              ...library.digitalContacts.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={contactId}
            onChange={(v) => setContactId(v ?? '')}
          />
          <Select
            label="RX group list"
            description="UUID reference"
            data={[
              { value: '', label: '— none —' },
              ...library.rxGroupLists.map((r) => ({ value: r.id, label: r.name })),
            ]}
            value={rxGroupListId}
            onChange={(v) => setRxGroupListId(v ?? '')}
          />
        </FormSection>
      )}

      {entity ? <RepeaterVerifyPanel channel={liveChannel} /> : null}

      {error ? <Alert color="red">{error}</Alert> : null}
      <Group>
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button component={Link} to="/library/channels" variant="light">
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
