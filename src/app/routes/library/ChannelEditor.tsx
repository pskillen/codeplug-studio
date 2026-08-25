import { useEffect, useMemo, useState } from 'react';
import { Alert, Select, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
import { PercentLevelSlider, UnsavedChangesModal } from '../../components/v2/index.ts';
import {
  Button,
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  Panel,
  SectionNav,
  SegmentedControl,
  StickyFooter,
  TextInput,
} from '../../components/v2/index.ts';
import { type ChannelMode as UiChannelMode, modeLabel } from '../../lib/channelModes.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import ForbidTransmitSegment from '../../components/channels/ForbidTransmitSegment.tsx';
import TxPermitSegment from '../../components/channels/TxPermitSegment.tsx';
import TxOffsetControls from '../../components/channels/TxOffsetControls.tsx';
import ScanInclusionSegment from '../../components/channels/ScanInclusionSegment.tsx';
import ChannelLocationSection, {
  channelLocationValuesFromChannel,
  type ChannelLocationValues,
} from '../../components/channels/ChannelLocationSection.tsx';
import ChannelModeProfilesEditor from '../../components/channels/ChannelModeProfilesEditor.tsx';
import ChannelModesField from '../../components/channels/ChannelModesField.tsx';
import ChannelWireNameExamples from '../../components/channels/ChannelWireNameExamples.tsx';
import ChannelDirectoryVerifyActions from '../../components/repeaters/ChannelDirectoryVerifyActions.tsx';
import { BandPillForChannel } from '../../components/pills/BandPill.tsx';
import { formatChannelRxTxListCell } from '../../lib/formatFrequency.ts';
import ChannelZoneMembershipSection from '../../components/library/ChannelZoneMembershipSection.tsx';
import PowerLadderHints from '../../components/library/PowerLadderHints.tsx';
import ScanListSummary from '../../components/library/ScanListSummary.tsx';
import ChannelDeleteButton from '../../components/library/ChannelDeleteButton.tsx';
import ChannelAprsBindingSection, {
  channelAprsBindingFromChannel,
} from '../../components/library/ChannelAprsBindingSection.tsx';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { useSectionScrollSpy } from '../../hooks/useSectionScrollSpy.ts';
import { hzToMhzString, mhzStringToHz } from '../../lib/units.ts';
import { scrollToPageSection } from '../../lib/scrollToPageSection.ts';
import { persistence } from '../../state/persistence.ts';
import { channelEditorPageTitle } from './channelEditorPageTitle.ts';
import { channelEditorSections } from './channelEditorSections.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './ChannelEditor.module.css';

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
  const [base] = useState(() => entity ?? newChannel(projectId, ''));

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

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

  const { permitNavigationOnce, modalOpen, stay, leave, isDirty } =
    useEntityEditorUnsavedGuard(buildRow);

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

  // "Apply only": fills form state from a directory match, nothing persisted. Same fan-out
  // either way — only the fields ChannelDiffField can carry need handling (channelDiff.ts:
  // callsign, name, rxFrequency, txFrequency, rxTone, txTone, colourCode, mode, location,
  // maidenheadLocator, useLocation, comment — tones/colour code arrive inside modeProfiles).
  function applyDirectoryPatch(patched: Channel) {
    setName(patched.name);
    setCallsign(patched.callsign);
    setRx(hzToMhzString(patched.rxFrequency));
    setTx(hzToMhzString(patched.txFrequency));
    setComment(patched.comment);
    setModeProfiles(patched.modeProfiles);
    setPrimaryMode((prev) => reconcilePrimaryMode(prev, patched.modeProfiles));
    setLocation(channelLocationValuesFromChannel(patched));
  }

  // "Apply & save": the dialog has already persisted `patched` (same
  // persistence.putChannel(patched, channel.revision) call as today's saved-channel workflow,
  // unchanged). On a saved channel that's the whole job — the page's own key={revision}
  // remount (EntityEditorPage.tsx) picks up the change. On New channel there is no remount to
  // rely on yet, so land the operator on the freshly created channel's edit page, matching
  // handleDuplicate's existing navigate-to-new-row pattern above.
  function handleApplyAndSave(patched: Channel) {
    permitNavigationOnce();
    if (!entity) {
      navigate(`/library/channels/${patched.id}`);
    }
  }

  function handleSave() {
    const profileErrors = validateModeProfiles(modeProfiles);
    if (profileErrors.length > 0) {
      setValidationError(profileErrors[0] ?? 'Invalid mode profiles');
      return;
    }
    if (rx.trim() && !tx.trim()) {
      setValidationError(
        "TX frequency can't be blank — use Simplex above or enter a value manually.",
      );
      return;
    }
    setValidationError(null);
    const row = buildRow();
    void save(() => persistence.putChannel(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  function handleCancel() {
    navigate('/library/channels');
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

  const txFieldError =
    rx.trim() && !tx.trim()
      ? "TX frequency can't be blank — use Simplex above or enter a value manually."
      : undefined;
  const footerDirty = isDirty || txFieldError != null;

  const headerTitle = entity ? liveChannel.name || 'Untitled channel' : 'New channel';
  const headerSubtitle = entity
    ? `${selectedModes.map((m) => modeLabel(m)).join(' + ')} · editing`
    : 'Set up the identity, frequency and mode for this channel.';

  useEffect(() => {
    onPageTitle?.(editorPageTitle);
  }, [editorPageTitle, onPageTitle]);

  const scanListOptions = [
    { value: '', label: 'None' },
    ...library.scanLists.map((list) => ({ value: list.id, label: list.name })),
  ];

  const editorSections = useMemo(() => channelEditorSections({ isNew: !entity }), [entity]);
  const sectionIds = useMemo(() => editorSections.map((s) => s.id), [editorSections]);
  const activeSectionId = useSectionScrollSpy(sectionIds);

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

  if (loadingProp) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <p className={classes.loading}>Loading…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Channels"
          crumbTo="/library/channels"
          title={headerTitle}
          subtitle={headerSubtitle}
          compact={isMobile}
        />

        <div className={classes.stickyNav}>
          <SectionNav
            items={editorSections}
            active={activeSectionId}
            onChange={scrollToPageSection}
            orientation="horizontal"
          />
        </div>

        <div className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}>
          {!entity ? (
            <Alert color="blue" variant="light" className={classes.alert}>
              Know the callsign? Use the lookup buttons below. Don&apos;t know it? Browse{' '}
              <Link to="/library/channels/add-from-ukrepeater">ukrepeater.net</Link> or{' '}
              <Link to="/library/channels/add-from-brandmeister">BrandMeister</Link>.
            </Alert>
          ) : null}

          <Panel id="identity" title="Identity">
            <div className={classes.identityCallsign}>
              <FormField label="Callsign (optional)">
                <TextInput
                  variant="plain"
                  value={callsign}
                  onChange={(e) => setCallsign(e.currentTarget.value)}
                  mono
                  aria-label="Callsign"
                />
              </FormField>
              <ChannelDirectoryVerifyActions
                channel={liveChannel}
                onApplyAndSave={handleApplyAndSave}
                onApplyAndContinue={applyDirectoryPatch}
                mode={entity ? 'verify' : 'lookup'}
              />
            </div>
            <div className={classes.identityName}>
              <FormField label="Name">
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
            </div>
            <button
              type="button"
              className={classes.identityRfSummary}
              onClick={() => scrollToPageSection('rf')}
              aria-label="Jump to RF section"
            >
              <span className={classes.identityRfSummaryText}>
                {formatChannelRxTxListCell(liveRxHz, liveTxHz)}
              </span>
              <BandPillForChannel channel={liveChannel} size="xs" />
            </button>
            <div className={classes.identityModes}>
              <ChannelModesField selectedModes={selectedModes} onChange={handleModesChange} />
            </div>
          </Panel>

          <Panel id="naming" title="Names and notes" collapsible defaultCollapsed={isMobile}>
            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
            >
              <FormField label="Abbreviation (optional)">
                <TextInput
                  variant="plain"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.currentTarget.value)}
                  aria-label="Abbreviation"
                />
              </FormField>
              <FormField label="Comment">
                <TextInput
                  variant="plain"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  aria-label="Comment"
                />
              </FormField>
            </div>
            <div className={classes.namingWireExamples}>
              <ChannelWireNameExamples
                callsign={callsign}
                name={name}
                abbreviation={abbreviation}
              />
            </div>
          </Panel>

          <Panel id="rf" title="RF">
            <FormField label="RX frequency (MHz)" mono>
              <TextInput
                variant="plain"
                value={rx}
                onChange={(e) => setRx(e.currentTarget.value)}
                mono
                aria-label="RX frequency"
              />
            </FormField>
            <div className={classes.rfGap}>
              <TxOffsetControls
                rxFrequencyHz={liveRxHz}
                txFrequencyHz={liveTxHz}
                onTxFrequencyChange={setTx}
              />
            </div>
            <FormField label="TX frequency (MHz)" mono error={txFieldError}>
              <TextInput
                variant="plain"
                value={tx}
                onChange={(e) => setTx(e.currentTarget.value)}
                mono
                aria-label="TX frequency"
              />
            </FormField>
            <p className={classes.bandHint}>
              Offsets shown match this frequency&apos;s band when RX is set.
            </p>
            <Stack gap="lg" className={classes.rfTx}>
              <ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />
              <TxPermitSegment value={txPermit} onChange={setTxPermit} />
            </Stack>
            <div className={classes.powerRow}>
              <PercentLevelSlider label="Power" value={power} onChange={setPower} />
              {isMobile ? (
                <details className={classes.hintDetails}>
                  <summary>Power examples</summary>
                  <PowerLadderHints power={power} />
                </details>
              ) : (
                <PowerLadderHints power={power} />
              )}
            </div>
          </Panel>

          <Panel
            id="mode-settings"
            title="Mode settings"
            sub={
              modeProfiles.length > 1
                ? 'Multiple modes selected — each stacks its own settings in one panel.'
                : undefined
            }
          >
            {modeProfiles.length > 1 ? (
              <div className={classes.primaryMode}>
                <p className={classes.primaryModeLabel}>Primary mode</p>
                <SegmentedControl
                  options={modeProfiles.map((profile) => ({
                    value: profile.mode,
                    label: modeLabel(profile.mode),
                  }))}
                  value={resolveChannelPrimaryMode({ primaryMode, modeProfiles }) ?? ''}
                  onChange={(value) => setPrimaryMode(value as ChannelMode)}
                />
                <p className={classes.primaryModeHint}>
                  Primary mode drives dual-mode Channel Type on Anytone and DM32 export.
                </p>
              </div>
            ) : null}
            <ChannelModeProfilesEditor
              profiles={modeProfiles}
              library={library}
              channel={entity ? liveChannel : null}
              rxFrequency={liveRxHz}
              txFrequency={liveTxHz}
              onChange={setModeProfiles}
            />
          </Panel>

          <Panel id="location" title="Location">
            <ChannelLocationSection value={location} onChange={setLocation} compact={isMobile} />
          </Panel>

          {entity ? (
            <Panel id="zones" title="Zones">
              <ChannelZoneMembershipSection channelId={entity.id} library={library} />
            </Panel>
          ) : null}

          <Panel id="scanning" title="Scanning">
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

          <Panel id="aprs" title="APRS">
            <ChannelAprsBindingSection
              aprsConfiguration={library.aprsConfiguration}
              channels={library.channels}
              value={aprsBinding}
              onChange={setAprsBinding}
            />
          </Panel>

          {entity ? (
            <div className={classes.browseBar}>
              <div className={classes.browseNav}>
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
            </div>
          ) : null}

          {entity ? (
            <div className={classes.legacyActions}>
              <Button variant="ghost" size="sm" onClick={() => void handleDuplicate()}>
                Duplicate
              </Button>
              <ChannelDeleteButton
                channel={entity}
                onDeleted={() => navigate('/library/channels')}
              />
            </div>
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
        </div>

        <StickyFooter
          saveLabel="Save channel"
          dirty={footerDirty}
          onCancel={handleCancel}
          onSave={handleSave}
          saving={saving}
          compact={isMobile}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}

function TextBrowseHint({ index, total }: { index: number; total: number }) {
  if (index < 0 || total === 0) return null;
  return (
    <span className={classes.browseHint}>
      Channel {index + 1} of {total}
    </span>
  );
}
