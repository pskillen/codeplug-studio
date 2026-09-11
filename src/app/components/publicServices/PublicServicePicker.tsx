import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select } from '@mantine/core';
import { IconPlaylistAdd } from '@tabler/icons-react';
import {
  classifyPublicServiceDedup,
  generateChannelsFromGroups,
} from '@core/domain/publicServices/index.ts';
import type {
  PublicServiceCategory,
  PublicServiceCountry,
  PublicServiceGroup,
  PublicServiceMode,
} from '@core/domain/publicServices/types.ts';
import { buildPublicServiceImportPlan } from '@core/services/publicServiceImport.ts';
import ModePill from '../pills/ModePill.tsx';
import DirectoryIngestPage from '../directories/DirectoryIngestPage.tsx';
import pageClasses from '../directories/DirectoryIngestPage.module.css';
import {
  Button,
  Checkbox,
  DataTable,
  FormField,
  Panel,
  Pill,
  StatusBanner,
  ToggleSwitch,
  type DataTableColumn,
} from '../v2/index.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import {
  availableCountries,
  countryCodeFromLocale,
  loadCountry,
} from '../../lib/publicServiceCountries.ts';
import {
  formatPublicServiceImportMessage,
  persistPublicServiceImport,
} from '../../lib/publicServiceImport.ts';
import classes from './PublicServicePicker.module.css';

const CATEGORY_LABEL: Record<PublicServiceCategory, string> = {
  fire: 'Fire',
  maritime: 'Maritime',
  sar: 'Search and rescue',
  ambulance: 'Ambulance',
  utility: 'Utility',
  transport: 'Transport',
  event: 'Event',
  other: 'Other',
};

const LEGAL_COPY =
  'Receive-only. Every channel added here has transmit forbidden and cannot be set otherwise during import. Reception rules vary by country — you are responsible for compliance where you operate.';

type PreviewStatus = 'add' | 'add_advisory' | 'skip_name';

interface PreviewRow {
  name: string;
  rxHz: number;
  txHz: number;
  modes: PublicServiceMode[];
  status: PreviewStatus;
  advisoryExistingName?: string;
}

function previewStatusLabel(row: PreviewRow): string {
  switch (row.status) {
    case 'add':
      return 'Will add';
    case 'add_advisory':
      return `Will add — you already have a channel on this frequency (${row.advisoryExistingName})`;
    case 'skip_name':
      return 'Already in library';
  }
}

function previewStatusTone(status: PreviewStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'add') return 'success';
  if (status === 'add_advisory') return 'warning';
  return 'neutral';
}

function formatFrequencyCell(rxHz: number, txHz: number): string {
  if (rxHz === txHz) {
    return `${hzToMhzString(rxHz)} simplex`;
  }
  return `${hzToMhzString(rxHz)} / ${hzToMhzString(txHz)}`;
}

function groupModeSummary(group: PublicServiceGroup): string {
  const modes = new Set<PublicServiceMode>();
  for (const entry of group.entries) {
    for (const spec of entry.modes) modes.add(spec.mode);
  }
  if (modes.has('fm') && modes.has('dmr')) return 'FM + DMR';
  if (modes.has('dmr')) return 'DMR';
  return 'FM';
}

function isPreviewSelectable(status: PreviewStatus): boolean {
  return status === 'add' || status === 'add_advisory';
}

export default function PublicServicePicker() {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();
  const countries = availableCountries();

  const [countryCode, setCountryCode] = useState<string | null>(() =>
    countryCodeFromLocale(typeof navigator !== 'undefined' ? navigator.language : undefined),
  );
  const [country, setCountry] = useState<PublicServiceCountry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedPreviewKeys, setSelectedPreviewKeys] = useState<Set<string>>(new Set());
  const [alsoCreateZones, setAlsoCreateZones] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCode) {
      setCountry(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadCountry(countryCode)
      .then((loaded) => {
        if (cancelled) return;
        setCountry(loaded);
        setSelectedGroupIds(new Set(loaded.groups.map((group) => group.groupId)));
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setCountry(null);
        setLoadError(caught instanceof Error ? caught.message : 'Could not load country dataset.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  const previewRows = useMemo((): PreviewRow[] => {
    if (!activeProjectId || !country) return [];
    const groupIds = [...selectedGroupIds];
    const generated = generateChannelsFromGroups(activeProjectId, country, groupIds);
    const dedup = classifyPublicServiceDedup(library.channels, generated);
    const skipName = new Set(dedup.skippedByName.map((channel) => channel.name));
    const advisoryByName = new Map(
      dedup.advisories.map((advisory) => [advisory.channel.name, advisory.existingName] as const),
    );

    return generated.map((channel) => {
      let status: PreviewStatus = 'add';
      if (skipName.has(channel.name)) status = 'skip_name';
      else if (advisoryByName.has(channel.name)) status = 'add_advisory';
      return {
        name: channel.name,
        rxHz: channel.rxFrequency ?? 0,
        txHz: channel.txFrequency ?? 0,
        modes: channel.modeProfiles.map((profile) => profile.mode as PublicServiceMode),
        status,
        advisoryExistingName: advisoryByName.get(channel.name),
      };
    });
  }, [activeProjectId, country, selectedGroupIds, library.channels]);

  const addablePreviewKey = previewRows
    .filter((row) => isPreviewSelectable(row.status))
    .map((row) => row.name)
    .join('\0');
  useEffect(() => {
    setSelectedPreviewKeys(new Set(addablePreviewKey ? addablePreviewKey.split('\0') : []));
  }, [addablePreviewKey]);

  const selectedKeys = useMemo(
    () =>
      previewRows
        .filter((row) => isPreviewSelectable(row.status) && selectedPreviewKeys.has(row.name))
        .map((row) => row.name),
    [previewRows, selectedPreviewKeys],
  );

  const addCount = selectedKeys.length;

  function onSelectionChange(keys: string[]) {
    const addable = new Set(
      previewRows.filter((row) => isPreviewSelectable(row.status)).map((row) => row.name),
    );
    setSelectedPreviewKeys(new Set(keys.filter((key) => addable.has(key))));
  }

  const previewColumns = useMemo((): DataTableColumn<PreviewRow>[] => {
    return [
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name,
        sortValue: (row) => row.name,
      },
      {
        key: 'rxTx',
        header: 'RX / TX (MHz)',
        hideOnMobile: true,
        render: (row) => formatFrequencyCell(row.rxHz, row.txHz),
      },
      {
        key: 'mode',
        header: 'Mode',
        width: '140px',
        render: (row) => (
          <span className={classes.modePills}>
            {row.modes.map((mode) => (
              <ModePill key={mode} mode={mode} size="xs" />
            ))}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <Pill tone={previewStatusTone(row.status)}>{previewStatusLabel(row)}</Pill>,
      },
    ];
  }, []);

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (checked) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  }

  async function handleAdd() {
    if (!activeProjectId || !country || addCount === 0) return;
    setAdding(true);
    setError(null);
    setSuccess(null);

    const plan = buildPublicServiceImportPlan(
      library,
      activeProjectId,
      country,
      [...selectedGroupIds],
      { alsoCreateZones },
    );
    const keep = new Set(selectedKeys);
    const channelsToAdd = plan.channelsToAdd.filter((channel) => keep.has(channel.name));
    const keepIds = new Set(channelsToAdd.map((channel) => channel.id));
    const zones = plan.zones
      .map((zone) => ({
        ...zone,
        members: zone.members.filter(
          (member) => member.kind === 'channel' && keepIds.has(member.channelId),
        ),
      }))
      .filter((zone) => zone.members.length > 0);

    const outcome = await persistPublicServiceImport({
      persistence,
      plan: {
        ...plan,
        channelsToAdd,
        advisories: plan.advisories.filter((advisory) => keep.has(advisory.channel.name)),
        zones,
      },
    });

    setAdding(false);

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }

    const zoneNames = zones.map((zone) => zone.name);
    const message = formatPublicServiceImportMessage(outcome, alsoCreateZones ? zoneNames : []);
    setSuccess(message);
    navigate('/library/channels', { state: { channelSetMessage: message } });
  }

  const countryOptions = countries.map((summary) => ({
    value: summary.countryCode,
    label: summary.countryLabel,
  }));

  return (
    <DirectoryIngestPage
      crumb="Channels"
      crumbTo="/library/channels"
      title="Import public service channels"
      subtitle="Receive-only memories for published, unencrypted service allocations near the amateur bands."
      footer={
        <Button variant="secondary" onClick={() => navigate('/library/channels')}>
          Cancel
        </Button>
      }
    >
      {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
      {success ? <StatusBanner tone="success">{success}</StatusBanner> : null}
      {loadError ? <StatusBanner tone="warning">{loadError}</StatusBanner> : null}

      <StatusBanner tone="info">{LEGAL_COPY}</StatusBanner>

      <Panel title="Country">
        <FormField
          label="Country"
          hint="Pre-selected from your browser locale when we have a dataset for that region."
        >
          <Select
            data={countryOptions}
            value={countryCode}
            placeholder="Choose a country"
            onChange={(value) => setCountryCode(value)}
            variant="unstyled"
          />
        </FormField>
        {country && country.knownGaps.length > 0 ? (
          <div>
            <p>
              <strong>Not available for {country.countryLabel}.</strong> Expected services that are
              encrypted or unpublished are listed so a missing group is not mistaken for unfinished
              data.
            </p>
            {country.knownGaps.map((gap) => (
              <p key={gap.category} className={classes.gapNote}>
                {CATEGORY_LABEL[gap.category]} — {gap.summary}
                {gap.sourceUrl ? (
                  <>
                    {' '}
                    <a href={gap.sourceUrl} target="_blank" rel="noreferrer">
                      Sources
                    </a>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel title="Groups">
        {loading ? <p>Loading dataset…</p> : null}
        {!loading && !country ? (
          <p>Choose a country to see published channel groups.</p>
        ) : null}
        {country ? (
          <div className={classes.groupList}>
            {country.groups.map((group) => (
              <label key={group.groupId} className={classes.groupRow}>
                <Checkbox
                  checked={selectedGroupIds.has(group.groupId)}
                  onCheckedChange={(checked) => toggleGroup(group.groupId, checked)}
                  aria-label={group.label}
                />
                <span className={classes.groupBody}>
                  <span className={classes.groupLabel}>{group.label}</span>
                  <span className={classes.groupMeta}>
                    <Pill>{CATEGORY_LABEL[group.category]}</Pill>
                    <Pill>{groupModeSummary(group)}</Pill>
                    <span>
                      {group.entries.length} channel{group.entries.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}
        <ToggleSwitch
          label="Also create a zone per selected group"
          checked={alsoCreateZones}
          onChange={setAlsoCreateZones}
        />
      </Panel>

      <Panel title={`Preview (${previewRows.length} channels)`}>
        <DataTable
          variant="embedded"
          rows={previewRows}
          getRowId={(row) => row.name}
          columns={previewColumns}
          caption={`${addCount} selected to add`}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={onSelectionChange}
          isRowSelectable={(row) => isPreviewSelectable(row.status)}
        />
        <div className={pageClasses.filterActions} style={{ marginTop: 12 }}>
          <Button
            leftSection={<IconPlaylistAdd size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            onClick={() => void handleAdd()}
            loading={adding}
            disabled={addCount === 0}
          >
            Add {addCount} channel{addCount === 1 ? '' : 's'}
          </Button>
        </div>
      </Panel>
    </DirectoryIngestPage>
  );
}
