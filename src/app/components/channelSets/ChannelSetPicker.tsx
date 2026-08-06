import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select } from '@mantine/core';
import { IconPlaylistAdd } from '@tabler/icons-react';
import {
  CHANNEL_SET_DEFINITIONS,
  classifyChannelSetDedup,
  generateChannelsFromSet,
} from '@core/domain/channelSets/index.ts';
import type { ChannelSetId } from '@core/domain/channelSets/types.ts';
import { channelSetDefinition } from '@core/domain/channelSets/definitions.ts';
import { buildChannelSetImportPlan } from '@core/services/channelSetImport.ts';
import ModePill from '../pills/ModePill.tsx';
import DirectoryIngestPage from '../directories/DirectoryIngestPage.tsx';
import pageClasses from '../directories/DirectoryIngestPage.module.css';
import {
  Button,
  DataTable,
  FormField,
  Panel,
  Pill,
  StatusBanner,
  TextInput,
  ToggleSwitch,
  type DataTableColumn,
} from '../v2/index.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import {
  formatChannelSetImportMessage,
  persistChannelSetImport,
} from '../../lib/channelSetImport.ts';

const SET_OPTIONS = CHANNEL_SET_DEFINITIONS.map((def) => ({
  value: def.id,
  label: `${def.label} (${def.templates().length} ch)`,
}));

const BANDWIDTH_OPTIONS = [
  { value: '12.5', label: '12.5 kHz (NFM)' },
  { value: '25', label: '25 kHz (wide FM)' },
];

type PreviewStatus = 'add' | 'skip_rx' | 'skip_name';

interface PreviewRow {
  index: number;
  name: string;
  rxHz: number;
  txHz: number;
  mode: string;
  status: PreviewStatus;
}

function previewStatusLabel(status: PreviewStatus): string {
  switch (status) {
    case 'add':
      return 'Will add';
    case 'skip_rx':
      return 'Skip (RX exists)';
    case 'skip_name':
      return 'Skip (name exists)';
  }
}

function previewStatusTone(status: PreviewStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'add') return 'success';
  return 'warning';
}

function formatFrequencyCell(rxHz: number, txHz: number): string {
  if (rxHz === txHz) {
    return `${hzToMhzString(rxHz)} simplex`;
  }
  return `${hzToMhzString(rxHz)} / ${hzToMhzString(txHz)}`;
}

function allIndices(count: number): Set<number> {
  return new Set(Array.from({ length: count }, (_, i) => i));
}

export default function ChannelSetPicker() {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const { library } = useLibrary();

  const [setId, setSetId] = useState<ChannelSetId>('pmr446');
  const [namePrefix, setNamePrefix] = useState('');
  const [power, setPower] = useState<number | string>('');
  const [bandwidthKHz, setBandwidthKHz] = useState('12.5');
  const [forbidTransmit, setForbidTransmit] = useState<boolean | null>(null);
  const [alsoCreateZone, setAlsoCreateZone] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() =>
    allIndices(channelSetDefinition('pmr446').templates().length),
  );
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const definition = channelSetDefinition(setId);

  const effectiveForbidTransmit = forbidTransmit ?? definition.defaultForbidTransmit;
  const powerValue = power === '' ? null : Number(power);
  const bandwidthValue = Number(bandwidthKHz);

  const generateOptions = useMemo(
    () => ({
      namePrefix: namePrefix || undefined,
      power: powerValue,
      forbidTransmit: effectiveForbidTransmit,
      bandwidthKHz: bandwidthValue,
    }),
    [namePrefix, powerValue, effectiveForbidTransmit, bandwidthValue],
  );

  const previewRows = useMemo((): PreviewRow[] => {
    if (!activeProjectId) return [];
    const generated = generateChannelsFromSet(activeProjectId, setId, generateOptions);
    const dedup = classifyChannelSetDedup(library.channels, generated);
    const skipRx = new Set(dedup.skippedByRxHz.map((ch) => ch.id));
    const skipName = new Set(dedup.skippedByName.map((ch) => ch.id));

    return generated.map((ch, index) => {
      let status: PreviewStatus = 'add';
      if (skipRx.has(ch.id)) status = 'skip_rx';
      else if (skipName.has(ch.id)) status = 'skip_name';
      const mode = ch.modeProfiles[0]?.mode ?? 'fm';
      return {
        index,
        name: ch.name,
        rxHz: ch.rxFrequency ?? 0,
        txHz: ch.txFrequency ?? 0,
        mode,
        status,
      };
    });
  }, [activeProjectId, setId, generateOptions, library.channels]);

  const selectedKeys = useMemo(
    () =>
      previewRows
        .filter((row) => row.status === 'add' && selectedIndices.has(row.index))
        .map((row) => String(row.index)),
    [previewRows, selectedIndices],
  );

  const addCount = selectedKeys.length;

  function onSelectionChange(keys: string[]) {
    const addable = new Set(
      previewRows.filter((row) => row.status === 'add').map((row) => row.index),
    );
    setSelectedIndices(
      new Set(keys.map((key) => Number(key)).filter((index) => addable.has(index))),
    );
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
        width: '80px',
        render: (row) => <ModePill mode={row.mode as 'fm'} size="xs" />,
      },
      {
        key: 'status',
        header: 'Status',
        width: '140px',
        render: (row) => (
          <Pill tone={previewStatusTone(row.status)}>{previewStatusLabel(row.status)}</Pill>
        ),
      },
    ];
  }, []);

  async function handleAdd() {
    if (!activeProjectId || addCount === 0) return;
    setAdding(true);
    setError(null);
    setSuccess(null);

    const includedIndices = previewRows
      .filter((r) => r.status === 'add' && selectedIndices.has(r.index))
      .map((r) => r.index);

    const plan = buildChannelSetImportPlan(library, activeProjectId, setId, {
      ...generateOptions,
      alsoCreateZone,
      zoneName: zoneName.trim() || definition.label,
      includedIndices,
    });

    const outcome = await persistChannelSetImport({
      persistence,
      library,
      projectId: activeProjectId,
      plan,
    });

    setAdding(false);

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }

    const message = formatChannelSetImportMessage(
      outcome,
      alsoCreateZone ? zoneName.trim() || definition.label : undefined,
    );
    setSuccess(message);

    if (outcome.zoneId) {
      navigate(`/library/zones/${outcome.zoneId}`, { state: { channelSetMessage: message } });
    } else {
      navigate('/library/channels', { state: { channelSetMessage: message } });
    }
  }

  return (
    <DirectoryIngestPage
      crumb="Channels"
      crumbTo="/library/channels"
      title="Import a curated channel set"
      subtitle="Pick a set, review what will be added, then import. Duplicate RX frequencies in the library are skipped."
      footer={
        <Button variant="secondary" onClick={() => navigate('/library/channels')}>
          Cancel
        </Button>
      }
    >
      {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
      {success ? <StatusBanner tone="success">{success}</StatusBanner> : null}

      <Panel title="Channel set">
        <FormField label="Set" hint={definition.description}>
          <Select
            data={SET_OPTIONS}
            value={setId}
            onChange={(value) => {
              if (value) {
                const id = value as ChannelSetId;
                setSetId(id);
                setForbidTransmit(null);
                setSelectedIndices(allIndices(channelSetDefinition(id).templates().length));
              }
            }}
            variant="unstyled"
          />
        </FormField>
      </Panel>

      <Panel title="Options">
        <div className={pageClasses.filterGrid}>
          <FormField
            label="Name prefix"
            hint="Optional prefix for every generated channel name"
            className={pageClasses.filterFieldWide}
          >
            <TextInput
              variant="plain"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.currentTarget.value)}
            />
          </FormField>
          <FormField
            label="Power (%)"
            hint="Leave empty for radio default"
            className={pageClasses.filterField}
          >
            <TextInput
              variant="plain"
              type="number"
              min={0}
              max={100}
              value={power}
              onChange={(e) => setPower(e.currentTarget.value)}
            />
          </FormField>
          <FormField
            label="Bandwidth (kHz)"
            hint="FM channel bandwidth applied to every generated channel"
            className={pageClasses.filterField}
          >
            <Select
              data={BANDWIDTH_OPTIONS}
              value={bandwidthKHz}
              onChange={(value) => setBandwidthKHz(value ?? '12.5')}
              variant="unstyled"
            />
          </FormField>
        </div>
        <ToggleSwitch
          label="Forbid transmit"
          checked={effectiveForbidTransmit}
          onChange={(checked) => setForbidTransmit(checked)}
        />
        <ToggleSwitch
          label="Also create zone"
          checked={alsoCreateZone}
          onChange={setAlsoCreateZone}
        />
        {alsoCreateZone ? (
          <FormField label="Zone name" className={pageClasses.filterField}>
            <TextInput
              variant="plain"
              value={zoneName}
              placeholder={definition.label}
              onChange={(e) => setZoneName(e.currentTarget.value)}
            />
          </FormField>
        ) : null}
      </Panel>

      <Panel title={`Preview (${previewRows.length} channels)`}>
        <DataTable
          variant="embedded"
          rows={previewRows}
          getRowId={(row) => String(row.index)}
          columns={previewColumns}
          caption={`${addCount} selected to add`}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={onSelectionChange}
          isRowSelectable={(row) => row.status === 'add'}
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
