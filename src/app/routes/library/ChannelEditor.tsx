import { useEffect, useMemo, useState } from 'react';
import { Alert, Select, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCheck } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ChannelAprsBinding } from '@core/models/aprs.ts';
import type {
  ForbidTransmitOverride,
  TxPermitOverride,
} from '@core/models/channelBehaviourDefaults.ts';
import type { Channel, ChannelModeProfile, Library, ScanInclusion } from '@core/models/library.ts';
import { reconcileChannelLocation } from '@core/domain/channelLocation.ts';
import { normalizeOptionalChannelAprs } from '@core/domain/aprs/index.ts';
import { newChannel } from '@core/domain/factories.ts';
import {
  syncModeProfiles,
  validateModeProfiles,
  reconcilePrimaryMode,
  resolveChannelPrimaryMode,
} from '@core/domain/modeProfiles.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  GradientSegmentedControl,
  PercentLevelSlider,
  UnsavedChangesModal,
} from '../../components/ui/index.ts';
import {
  Button,
  DesignSystemV2Provider,
  FormField,
  Panel,
  Pill,
  SectionNav,
  TextInput,
} from '../../components/v2/index.ts';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import {
  CHANNEL_MODES,
  modeColor,
  modeLabel,
  type ChannelMode as UiChannelMode,
} from '../../lib/channelModes.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import ForbidTransmitSegment from '../../components/channels/ForbidTransmitSegment.tsx';
import TxPermitSegment from '../../components/channels/TxPermitSegment.tsx';
import TxOffsetControls from '../../components/channels/TxOffsetControls.tsx';
import ScanInclusionSegment from '../../components/channels/ScanInclusionSegment.tsx';
import ChannelLocationSection, {
  channelLocationValuesFromChannel,
  type ChannelLocationValues,
} from '../../components/channels/ChannelLocationSection.tsx';
import ChannelModeProfilesEditor from '../../components/channels/ChannelModeProfilesEditor.tsx';
import ChannelWireNameExamples from '../../components/channels/ChannelWireNameExamples.tsx';
import RepeaterVerifyPanel from '../../components/repeaters/RepeaterVerifyPanel.tsx';
import ChannelZoneMembershipSection from '../../components/library/ChannelZoneMembershipSection.tsx';
import PowerLadderHints from '../../components/library/PowerLadderHints.tsx';
import ScanListSummary from '../../components/library/ScanListSummary.tsx';
import ChannelDeleteButton from '../../components/library/ChannelDeleteButton.tsx';
import ChannelAprsBindingSection, {
  channelAprsBindingFromChannel,
} from '../../components/library/ChannelAprsBindingSection.tsx';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { hzToMhzString, mhzStringToHz } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { channelEditorPageTitle } from './channelEditorPageTitle.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './ChannelEditor.module.css';

const EDITOR_SECTIONS = [
  'Identity',
  'Frequencies',
  'Modes',
  'Scanning',
  'APRS',
  'Location',
  'Zones',
  'Repeater info',
] as const;

type EditorSection = (typeof EDITOR_SECTIONS)[number];

function sectionId(section: EditorSection): string {
  return section;
}

export default function ChannelEditor({
  projectId,
  entity,
  library,
  onPageTitle,
  loading: loadingProp = false,
}: {
  projectId: string;
  entity: Channel | null;
  library: Library;
  onPageTitle?: (title: string) => void;
  loading?: boolean;
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
  const [forbidTransmit, setForbidTransmit] = useState<ForbidTransmitOverride>(base.forbidTransmit);
  const [txPermit, setTxPermit] = useState<TxPermitOverride>(base.txPermit);
  const [comment, setComment] = useState(base.comment);
  const [modeProfiles, setModeProfiles] = useState<ChannelModeProfile[]>(base.modeProfiles);
  const [primaryMode, setPrimaryMode] = useState<ChannelMode | null>(base.primaryMode ?? null);
  const [location, setLocation] = useState<ChannelLocationValues>(() =>
    channelLocationValuesFromChannel(base),
  );
  const [aprsBinding, setAprsBinding] = useState<ChannelAprsBinding>(() =>
    channelAprsBindingFromChannel(base),
  );
  const [activeSection, setActiveSection] = useState<EditorSection>('Identity');
  const [validationError, setValidationError] = useState<string | null>(null);
  const isMobileNav = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

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
      txPermit,
      comment,
      location: reconciled.location,
      useLocation: reconciled.useLocation,
      maidenheadLocator: reconciled.maidenheadLocator,
      modeProfiles,
      primaryMode: modeProfiles.length > 0 ? reconcilePrimaryMode(primaryMode, modeProfiles) : null,
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
    if (location.hideFromInternalMap) {
      row.hideFromInternalMap = true;
    } else {
      delete row.hideFromInternalMap;
    }
    const normalizedAprs = normalizeOptionalChannelAprs(aprsBinding);
    if (normalizedAprs) {
      row.aprs = normalizedAprs;
    } else {
      delete row.aprs;
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
      txPermit: source.txPermit,
      comment: source.comment,
      location: source.location,
      useLocation: source.useLocation,
      maidenheadLocator: source.maidenheadLocator,
      hideFromInternalMap: source.hideFromInternalMap,
      modeProfiles: source.modeProfiles.map((profile) => ({ ...profile })),
      primaryMode: source.primaryMode ?? null,
      aprs: source.aprs ? { ...source.aprs } : undefined,
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
    const nextProfiles = syncModeProfiles(coreModes, modeProfiles);
    setModeProfiles(nextProfiles);
    setPrimaryMode((prev) => reconcilePrimaryMode(prev, nextProfiles));
  }

  const liveRxHz = mhzStringToHz(rx);
  const liveTxHz = mhzStringToHz(tx);
  const liveChannel = buildRow();
  const editorPageTitle = channelEditorPageTitle(!entity, liveChannel);

  useEffect(() => {
    onPageTitle?.(editorPageTitle);
  }, [editorPageTitle, onPageTitle]);

  const scanListOptions = [
    { value: '', label: 'None' },
    ...library.scanLists.map((list) => ({ value: list.id, label: list.name })),
  ];

  const visibleSections = useMemo(
    () =>
      entity
        ? [...EDITOR_SECTIONS]
        : EDITOR_SECTIONS.filter((s) => s !== 'Zones' && s !== 'Repeater info'),
    [entity],
  );

  const browseChannelIds = useMemo(
    () => [...library.channels].sort((a, b) => a.name.localeCompare(b.name)).map((ch) => ch.id),
    [library.channels],
  );

  const browseIndex = entity ? browseChannelIds.indexOf(entity.id) : -1;
  const prevChannelId = browseIndex > 0 ? browseChannelIds[browseIndex - 1] : null;
  const nextChannelId =
    browseIndex >= 0 && browseIndex < browseChannelIds.length - 1
      ? browseChannelIds[browseIndex + 1]
      : null;

  function scrollToSection(section: EditorSection) {
    setActiveSection(section);
    document
      .getElementById(sectionId(section))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleMode(mode: ChannelMode) {
    const next = selectedModes.includes(mode)
      ? selectedModes.filter((m) => m !== mode)
      : [...selectedModes, mode];
    handleModesChange(next as UiChannelMode[]);
  }

  function v2HeaderModePill(mode: ChannelMode) {
    const color = modeColor(mode);
    const textColor =
      mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
        ? DSV2_TOKENS.colors.pillTextLight
        : DSV2_TOKENS.colors.pillTextDark;
    return (
      <Pill key={mode} tone="semantic" color={color} textColor={textColor}>
        {modeLabel(mode)}
      </Pill>
    );
  }

  if (loadingProp) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <p className={classes.headerName}>Loading…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <header className={classes.stickyHeader}>
          <Link to="/library/channels" className={classes.backLink}>
            ← Channels
          </Link>
          <div className={classes.headerDivider} aria-hidden />
          <div className={classes.headerIdentity}>
            <div className={classes.headerName}>{liveChannel.name || 'Untitled channel'}</div>
            {callsign ? <div className={classes.headerCallsign}>{callsign}</div> : null}
          </div>
          <div className={classes.headerFreq}>{formatChannelRxTxListCell(liveRxHz, liveTxHz)}</div>
          {selectedModes.length > 0 ? (
            <div className={classes.headerModes}>
              {selectedModes.map((mode) => v2HeaderModePill(mode))}
            </div>
          ) : null}
          <div className={classes.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/library/channels')}>
              Discard
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save channel
            </Button>
          </div>
        </header>

        {!entity ? (
          <Alert color="blue" variant="light" className={classes.alert}>
            Prefer importing from a directory? Use{' '}
            <Link to="/library/channels/add-from-ukrepeater">ukrepeater.net</Link> or{' '}
            <Link to="/library/channels/add-from-brandmeister">BrandMeister</Link> in the section
            nav.
          </Alert>
        ) : null}

        <div className={classes.layout}>
          <div className={classes.sectionRail}>
            <SectionNav
              items={visibleSections}
              active={activeSection}
              onChange={(item) => scrollToSection(item as EditorSection)}
              orientation={isMobileNav ? 'horizontal' : 'vertical'}
            />
          </div>

          <div className={classes.content}>
            <Panel id={sectionId('Identity')} title="Identity">
              <div className={classes.fieldGrid}>
                <FormField label="Name">
                  <TextInput
                    variant="plain"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    aria-label="Name"
                  />
                </FormField>
                <FormField label="Callsign">
                  <TextInput
                    variant="plain"
                    value={callsign}
                    onChange={(e) => setCallsign(e.currentTarget.value)}
                    aria-label="Callsign"
                  />
                </FormField>
                <FormField label="Abbreviation (optional)">
                  <TextInput
                    variant="plain"
                    value={abbreviation}
                    onChange={(e) => setAbbreviation(e.currentTarget.value)}
                    aria-label="Abbreviation"
                  />
                </FormField>
              </div>
              <Stack gap="sm" mt="md">
                <ChannelWireNameExamples
                  callsign={callsign}
                  name={name}
                  abbreviation={abbreviation}
                />
                <FormField label="Comment">
                  <TextInput
                    variant="plain"
                    value={comment}
                    onChange={(e) => setComment(e.currentTarget.value)}
                    aria-label="Comment"
                  />
                </FormField>
              </Stack>
            </Panel>

            <Panel id={sectionId('Frequencies')} title="Frequencies">
              <div className={classes.fieldGridTwo}>
                <FormField label="RX frequency (MHz)" mono>
                  <TextInput
                    variant="plain"
                    value={rx}
                    onChange={(e) => setRx(e.currentTarget.value)}
                    mono
                    aria-label="RX frequency"
                  />
                </FormField>
                <FormField label="TX frequency (MHz)" mono>
                  <TextInput
                    variant="plain"
                    value={tx}
                    onChange={(e) => setTx(e.currentTarget.value)}
                    mono
                    aria-label="TX frequency"
                  />
                </FormField>
              </div>
              <Stack gap="md" mt="md">
                <TxOffsetControls
                  rxFrequencyHz={liveRxHz}
                  txFrequencyHz={liveTxHz}
                  onTxFrequencyChange={setTx}
                />
                <PercentLevelSlider label="Power" value={power} onChange={setPower} />
                <PowerLadderHints power={power} />
                <ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />
                <TxPermitSegment value={txPermit} onChange={setTxPermit} />
              </Stack>
            </Panel>

            <Panel
              id={sectionId('Modes')}
              title="Modes"
              sub="Turn a mode on or off — its fields appear below when active."
            >
              <div className={classes.modeSwitcher}>
                {CHANNEL_MODES.filter((m) => m.id !== 'other').map((modeDef) => {
                  const mode = modeDef.id as ChannelMode;
                  const active = selectedModes.includes(mode);
                  const color = modeColor(mode);
                  const textColor =
                    mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
                      ? DSV2_TOKENS.colors.pillTextLight
                      : DSV2_TOKENS.colors.pillTextDark;
                  if (active) {
                    return (
                      <span key={mode} className={classes.modeActivePill}>
                        <Pill
                          tone="semantic"
                          color={color}
                          textColor={textColor}
                          onRemove={() => toggleMode(mode)}
                        >
                          <IconCheck size={12} stroke={2.5} aria-hidden />
                          {modeLabel(mode)}
                        </Pill>
                      </span>
                    );
                  }
                  return (
                    <Pill key={mode} tone="dashed" onClick={() => toggleMode(mode)}>
                      + {modeLabel(mode)}
                    </Pill>
                  );
                })}
              </div>
              {modeProfiles.length > 0 ? (
                <Stack gap="md">
                  <GradientSegmentedControl
                    label="Primary mode"
                    description="Primary mode drives dual-mode Channel Type on Anytone and DM32 export."
                    value={resolveChannelPrimaryMode({ primaryMode, modeProfiles }) ?? ''}
                    onChange={(value) => setPrimaryMode(value as ChannelMode)}
                    data={modeProfiles.map((profile) => ({
                      value: profile.mode,
                      label: modeLabel(profile.mode),
                    }))}
                    segmentColors={modeProfiles.map((profile) => modeColor(profile.mode))}
                    fullWidth
                  />
                  <ChannelModeProfilesEditor
                    profiles={modeProfiles}
                    library={library}
                    rxFrequency={liveRxHz}
                    txFrequency={liveTxHz}
                    onChange={setModeProfiles}
                  />
                </Stack>
              ) : null}
            </Panel>

            <Panel id={sectionId('Scanning')} title="Scanning">
              <Stack gap="lg">
                <ScanInclusionSegment value={scanInclusion} onChange={setScanInclusion} />
                <FormField label="Scan list">
                  <Select
                    data={scanListOptions}
                    value={scanListId}
                    onChange={(value) => setScanListId(value ?? '')}
                    clearable
                    searchable
                  />
                </FormField>
                <ScanListSummary listId={scanListId || null} library={library} />
              </Stack>
            </Panel>

            <Panel id={sectionId('APRS')} title="APRS">
              <ChannelAprsBindingSection
                aprsConfiguration={library.aprsConfiguration}
                channels={library.channels}
                value={aprsBinding}
                onChange={setAprsBinding}
              />
            </Panel>

            <Panel id={sectionId('Location')} title="Location">
              <ChannelLocationSection
                value={location}
                onChange={setLocation}
                mapActive={activeSection === 'Location'}
              />
            </Panel>

            {entity ? (
              <Panel id={sectionId('Zones')} title="Zones">
                <ChannelZoneMembershipSection channelId={entity.id} library={library} />
              </Panel>
            ) : null}

            {entity ? (
              <Panel id={sectionId('Repeater info')} title="Repeater info">
                <RepeaterVerifyPanel channel={liveChannel} library={library} />
              </Panel>
            ) : null}
          </div>
        </div>

        {entity ? (
          <footer className={classes.footerBar}>
            <div className={classes.footerNav}>
              <Button
                variant="outline"
                size="sm"
                disabled={!prevChannelId}
                onClick={() => prevChannelId && navigate(`/library/channels/${prevChannelId}`)}
              >
                ← Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextChannelId}
                onClick={() => nextChannelId && navigate(`/library/channels/${nextChannelId}`)}
              >
                Next →
              </Button>
            </div>
            <TextBrowseHint index={browseIndex} total={browseChannelIds.length} />
          </footer>
        ) : null}

        {validationError ? (
          <Alert color="red" className={classes.alert}>
            {validationError}
          </Alert>
        ) : null}
        {error ? (
          <Alert color="red" className={classes.alert}>
            {error}
          </Alert>
        ) : null}

        <div className={classes.legacyActions}>
          {entity ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => void handleDuplicate()}>
                Duplicate
              </Button>
              <ChannelDeleteButton
                channel={entity}
                onDeleted={() => navigate('/library/channels')}
              />
            </>
          ) : null}
        </div>

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}

function TextBrowseHint({ index, total }: { index: number; total: number }) {
  if (index < 0 || total === 0) return null;
  return (
    <span style={{ fontSize: '12px', color: 'var(--dsv2-text-tertiary)' }}>
      Channel {index + 1} of {total}
    </span>
  );
}
