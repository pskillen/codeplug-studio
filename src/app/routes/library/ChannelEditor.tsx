import { useState } from 'react';
import { Alert, Button, Checkbox, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { Channel, ChannelModeProfile, Library } from '@core/models/library.ts';
import { reconcileChannelLocation } from '@core/domain/channelLocation.ts';
import { newChannel } from '@core/domain/factories.ts';
import { syncModeProfiles, validateModeProfiles } from '@core/domain/modeProfiles.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import ForbidTransmitSegment from '../../components/channels/ForbidTransmitSegment.tsx';
import ChannelLocationSection, {
  channelLocationValuesFromChannel,
  type ChannelLocationValues,
} from '../../components/channels/ChannelLocationSection.tsx';
import ChannelModeProfilesEditor from '../../components/channels/ChannelModeProfilesEditor.tsx';
import ChannelModesMultiSelect from '../../components/channels/ChannelModesMultiSelect.tsx';
import ChannelWireNameExamples from '../../components/channels/ChannelWireNameExamples.tsx';
import type { ChannelMode as UiChannelMode } from '../../lib/channelModes.ts';
import RepeaterVerifyPanel from '../../components/repeaters/RepeaterVerifyPanel.tsx';
import ChannelZoneMembershipSection from '../../components/library/ChannelZoneMembershipSection.tsx';
import ChannelDeleteButton from '../../components/library/ChannelDeleteButton.tsx';
import { FormSection, PercentLevelSlider } from '../../components/ui/index.ts';
import { hzToMhzString, mhzStringToHz } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';

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

  const [name, setName] = useState(base.name);
  const [abbreviation, setAbbreviation] = useState(base.abbreviation ?? '');
  const [callsign, setCallsign] = useState(base.callsign);
  const [rx, setRx] = useState(hzToMhzString(base.rxFrequency));
  const [tx, setTx] = useState(hzToMhzString(base.txFrequency));
  const [power, setPower] = useState<number | null>(base.power);
  const [scanSkip, setScanSkip] = useState(base.scanSkip);
  const [forbidTransmit, setForbidTransmit] = useState(base.forbidTransmit === true);
  const [comment, setComment] = useState(base.comment);
  const [modeProfiles, setModeProfiles] = useState<ChannelModeProfile[]>(base.modeProfiles);
  const [location, setLocation] = useState<ChannelLocationValues>(() =>
    channelLocationValuesFromChannel(base),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const { save, saving, error } = useEntitySave('channels');
  const navigate = useNavigate();

  const selectedModes = modeProfiles.map((p) => p.mode as ChannelMode);

  function buildRow(): Channel {
    const lat = Number.parseFloat(location.lat);
    const lon = Number.parseFloat(location.lon);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
    const reconciled = reconcileChannelLocation({
      maidenheadLocator: location.maidenheadLocator || null,
      location: hasCoords ? { lat, lon } : null,
      useLocation: location.useLocation,
      lastEdited: location.lastEdited,
    });

    const trimmedAbbrev = abbreviation.trim();
    const row: Channel = {
      ...base,
      name: name.trim() || 'Untitled channel',
      callsign,
      rxFrequency: mhzStringToHz(rx),
      txFrequency: mhzStringToHz(tx),
      power,
      scanSkip,
      forbidTransmit,
      comment,
      location: reconciled.location,
      useLocation: reconciled.useLocation,
      maidenheadLocator: reconciled.maidenheadLocator,
      modeProfiles,
    };
    if (trimmedAbbrev) {
      row.abbreviation = trimmedAbbrev;
    } else {
      delete row.abbreviation;
    }
    return row;
  }

  function handleSave() {
    const profileErrors = validateModeProfiles(modeProfiles);
    if (profileErrors.length > 0) {
      setValidationError(profileErrors[0] ?? 'Invalid mode profiles');
      return;
    }
    setValidationError(null);
    const row = buildRow();
    void save(() => persistence.putChannel(row, entity ? entity.revision : null));
  }

  function handleModesChange(modes: UiChannelMode[]) {
    const coreModes = modes.filter((m): m is ChannelMode => m !== 'other');
    setModeProfiles(syncModeProfiles(coreModes, modeProfiles));
  }

  const liveChannel = buildRow();

  return (
    <Stack gap="lg" maw={640}>
      {!entity ? (
        <Alert color="blue" variant="light">
          Prefer importing from a directory? Use{' '}
          <Link to="/library/channels/add-from-ukrepeater">ukrepeater.net</Link> or{' '}
          <Link to="/library/channels/add-from-brandmeister">BrandMeister</Link> in the section nav.
        </Alert>
      ) : null}

      <FormSection title="Identity">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Callsign"
            description="The callsign, if this is a fixed station. Optional for simplex channels."
            value={callsign}
            onChange={(e) => setCallsign(e.currentTarget.value)}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Name"
            description="The full unabbreviated name of the channel. May be shortened on export."
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Abbreviation"
            description="Optional short label used when export shortening needs a shorter name."
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.currentTarget.value)}
          />
        </SimpleGrid>
        <ChannelWireNameExamples callsign={callsign} name={name} abbreviation={abbreviation} />
        <TextInput
          label="Comment"
          description="Optional comment for the channel. Usually internal but may be exported in some formats."
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Text component="label" htmlFor="scanSkip" size="sm" fw={500}>
          Scanning
        </Text>
        <Checkbox
          id="scanSkip"
          label="Skip on scan"
          checked={scanSkip}
          onChange={(e) => setScanSkip(e.currentTarget.checked)}
        />
      </FormSection>

      <FormSection title="Frequencies">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
        </SimpleGrid>
        <PercentLevelSlider label="Power" value={power} onChange={setPower} />
        <ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />
      </FormSection>

      <FormSection title="Modes">
        <ChannelModesMultiSelect value={selectedModes} onChange={handleModesChange} />
      </FormSection>

      {modeProfiles.length > 0 ? (
        <FormSection title="Mode profiles">
          <ChannelModeProfilesEditor
            profiles={modeProfiles}
            library={library}
            onChange={setModeProfiles}
          />
        </FormSection>
      ) : null}

      <ChannelLocationSection value={location} onChange={setLocation} />

      {entity ? (
        <FormSection title="Zone membership">
          <ChannelZoneMembershipSection channelId={entity.id} library={library} />
        </FormSection>
      ) : null}

      {entity ? <RepeaterVerifyPanel channel={liveChannel} library={library} /> : null}

      {validationError ? <Alert color="red">{validationError}</Alert> : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      <Group>
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button component={Link} to="/library/channels" variant="light">
          Cancel
        </Button>
        {entity ? (
          <ChannelDeleteButton channel={entity} onDeleted={() => navigate('/library/channels')} />
        ) : null}
      </Group>
    </Stack>
  );
}
