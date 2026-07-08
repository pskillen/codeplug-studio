import { useState } from 'react';
import { Alert, Button, Group, Select, SimpleGrid, Stack, Tabs, TextInput } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { Channel, ChannelModeProfile, Library, ScanInclusion } from '@core/models/library.ts';
import { reconcileChannelLocation } from '@core/domain/channelLocation.ts';
import { newChannel } from '@core/domain/factories.ts';
import { syncModeProfiles, validateModeProfiles } from '@core/domain/modeProfiles.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import ForbidTransmitSegment from '../../components/channels/ForbidTransmitSegment.tsx';
import ScanInclusionSegment from '../../components/channels/ScanInclusionSegment.tsx';
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
import ScanListSummary from '../../components/library/ScanListSummary.tsx';
import ChannelDeleteButton from '../../components/library/ChannelDeleteButton.tsx';
import { FormSection, PercentLevelSlider, UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
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
  const [scanInclusion, setScanInclusion] = useState<ScanInclusion>(base.scanInclusion);
  const [scanListId, setScanListId] = useState(base.scanListId ?? '');
  const [forbidTransmit, setForbidTransmit] = useState(base.forbidTransmit === true);
  const [comment, setComment] = useState(base.comment);
  const [modeProfiles, setModeProfiles] = useState<ChannelModeProfile[]>(base.modeProfiles);
  const [location, setLocation] = useState<ChannelLocationValues>(() =>
    channelLocationValuesFromChannel(base),
  );
  const [activeTab, setActiveTab] = useState('identity');
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
      scanInclusion,
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
    const trimmedScanListId = scanListId.trim();
    if (trimmedScanListId) {
      row.scanListId = trimmedScanListId;
    } else {
      delete row.scanListId;
    }
    return row;
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleDuplicate() {
    if (!entity) return;
    const source = buildRow();
    const copyName = `${source.name.trim() || 'Untitled channel'} (copy)`;
    const copy = newChannel(projectId, copyName, source.callsign);
    const row: Channel = {
      ...copy,
      abbreviation: source.abbreviation,
      rxFrequency: source.rxFrequency,
      txFrequency: source.txFrequency,
      power: source.power,
      scanInclusion: source.scanInclusion,
      scanListId: source.scanListId,
      forbidTransmit: source.forbidTransmit,
      comment: source.comment,
      location: source.location,
      useLocation: source.useLocation,
      maidenheadLocator: source.maidenheadLocator,
      modeProfiles: source.modeProfiles.map((profile) => ({ ...profile })),
    };
    void persistence.putChannel(row, null).then((result) => {
      if (result.ok) navigate(`/library/channels/${row.id}`);
    });
  }

  function handleSave() {
    const profileErrors = validateModeProfiles(modeProfiles);
    if (profileErrors.length > 0) {
      setValidationError(profileErrors[0] ?? 'Invalid mode profiles');
      return;
    }
    setValidationError(null);
    const row = buildRow();
    void save(() => persistence.putChannel(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  function handleModesChange(modes: UiChannelMode[]) {
    const coreModes = modes.filter((m): m is ChannelMode => m !== 'other');
    setModeProfiles(syncModeProfiles(coreModes, modeProfiles));
  }

  const liveChannel = buildRow();
  const scanListOptions = [
    { value: '', label: 'None' },
    ...library.scanLists.map((list) => ({ value: list.id, label: list.name })),
  ];

  return (
    <Stack gap="lg" maw={640}>
      {!entity ? (
        <Alert color="blue" variant="light">
          Prefer importing from a directory? Use{' '}
          <Link to="/library/channels/add-from-ukrepeater">ukrepeater.net</Link> or{' '}
          <Link to="/library/channels/add-from-brandmeister">BrandMeister</Link> in the section nav.
        </Alert>
      ) : null}

      <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
        <Tabs.List>
          <Tabs.Tab value="identity">Identity</Tabs.Tab>
          <Tabs.Tab value="frequencies">Frequencies</Tabs.Tab>
          <Tabs.Tab value="modes">Modes</Tabs.Tab>
          <Tabs.Tab value="scanning">Scanning</Tabs.Tab>
          <Tabs.Tab value="location">Location</Tabs.Tab>
          {entity ? <Tabs.Tab value="zones">Zones</Tabs.Tab> : null}
          {entity ? <Tabs.Tab value="verify">Repeater</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="identity" pt="md">
          <FormSection>
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
          </FormSection>
        </Tabs.Panel>

        <Tabs.Panel value="scanning" pt="md">
          <Stack gap="lg">
            <FormSection>
              <ScanInclusionSegment value={scanInclusion} onChange={setScanInclusion} />
            </FormSection>
            <FormSection>
              <Select
                label="Scan list"
                description="Dedicated scan list for CPS export (Channel.CSV Scan List column). List membership is edited under Library → Scan lists."
                data={scanListOptions}
                value={scanListId}
                onChange={(value) => setScanListId(value ?? '')}
                clearable
                searchable
              />
              <ScanListSummary listId={scanListId || null} library={library} />
            </FormSection>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="frequencies" pt="md">
          <FormSection>
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
        </Tabs.Panel>

        <Tabs.Panel value="modes" pt="md">
          <Stack gap="lg">
            <FormSection>
              <ChannelModesMultiSelect value={selectedModes} onChange={handleModesChange} />
            </FormSection>
            {modeProfiles.length > 0 ? (
              <FormSection>
                <ChannelModeProfilesEditor
                  profiles={modeProfiles}
                  library={library}
                  onChange={setModeProfiles}
                />
              </FormSection>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="location" pt="md">
          <ChannelLocationSection
            value={location}
            onChange={setLocation}
            mapActive={activeTab === 'location'}
          />
        </Tabs.Panel>

        {entity ? (
          <Tabs.Panel value="zones" pt="md">
            <ChannelZoneMembershipSection channelId={entity.id} library={library} />
          </Tabs.Panel>
        ) : null}

        {entity ? (
          <Tabs.Panel value="verify" pt="md">
            <RepeaterVerifyPanel channel={liveChannel} library={library} />
          </Tabs.Panel>
        ) : null}
      </Tabs>

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
          <>
            <Button variant="default" onClick={() => void handleDuplicate()}>
              Duplicate
            </Button>
            <ChannelDeleteButton channel={entity} onDeleted={() => navigate('/library/channels')} />
          </>
        ) : null}
      </Group>
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
