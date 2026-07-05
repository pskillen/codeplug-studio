import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
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
import { FormPage, PageSection } from '../ui/index.ts';
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

  const addCount = previewRows.filter(
    (r) => r.status === 'add' && selectedIndices.has(r.index),
  ).length;

  function toggleIndex(index: number, checked: boolean) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function toggleAllSelectable(checked: boolean) {
    if (checked) {
      setSelectedIndices(
        new Set(previewRows.filter((r) => r.status === 'add').map((r) => r.index)),
      );
    } else {
      setSelectedIndices(new Set());
    }
  }

  const selectableCount = previewRows.filter((r) => r.status === 'add').length;
  const allSelectableChecked =
    selectableCount > 0 &&
    previewRows.filter((r) => r.status === 'add').every((r) => selectedIndices.has(r.index));

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
    <FormPage
      title="Add channel set"
      description="Generate standard frequency inventories into your library. Duplicate RX frequencies in the library are skipped."
    >
      <Stack gap="lg">
        {error ? (
          <Alert color="red" title="Could not add channel set">
            {error}
          </Alert>
        ) : null}
        {success ? (
          <Alert color="green" title="Channel set added">
            {success}
          </Alert>
        ) : null}

        <PageSection title="Channel set">
          <Stack gap="md">
            <Select
              label="Set"
              description={definition.description}
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
            />
          </Stack>
        </PageSection>

        <PageSection title="Options">
          <Stack gap="md">
            <TextInput
              label="Name prefix"
              description="Optional prefix for every generated channel name"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.currentTarget.value)}
            />
            <NumberInput
              label="Power (%)"
              description="Leave empty for radio default"
              value={power}
              onChange={setPower}
              min={0}
              max={100}
              clampBehavior="strict"
            />
            <Select
              label="Bandwidth (kHz)"
              description="FM channel bandwidth applied to every generated channel"
              data={BANDWIDTH_OPTIONS}
              value={bandwidthKHz}
              onChange={(value) => setBandwidthKHz(value ?? '12.5')}
            />
            <Switch
              label="Forbid transmit"
              description="Receive-only at export (PMR446 defaults on)"
              checked={effectiveForbidTransmit}
              onChange={(e) => setForbidTransmit(e.currentTarget.checked)}
            />
            <Switch
              label="Also create zone"
              description="New library zone containing generated channels in set order"
              checked={alsoCreateZone}
              onChange={(e) => setAlsoCreateZone(e.currentTarget.checked)}
            />
            {alsoCreateZone ? (
              <TextInput
                label="Zone name"
                value={zoneName}
                placeholder={definition.label}
                onChange={(e) => setZoneName(e.currentTarget.value)}
              />
            ) : null}
          </Stack>
        </PageSection>

        <PageSection title={`Preview (${previewRows.length} channels)`}>
          <ScrollArea.Autosize mah={400}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Checkbox
                      aria-label="Select all addable channels"
                      checked={allSelectableChecked}
                      indeterminate={addCount > 0 && addCount < selectableCount}
                      onChange={(e) => toggleAllSelectable(e.currentTarget.checked)}
                      disabled={selectableCount === 0}
                    />
                  </Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>RX / TX (MHz)</Table.Th>
                  <Table.Th>Mode</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {previewRows.map((row) => (
                  <Table.Tr key={`${row.name}-${row.rxHz}`}>
                    <Table.Td>
                      <Checkbox
                        aria-label={`Include ${row.name}`}
                        checked={selectedIndices.has(row.index)}
                        disabled={row.status !== 'add'}
                        onChange={(e) => toggleIndex(row.index, e.currentTarget.checked)}
                      />
                    </Table.Td>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>{formatFrequencyCell(row.rxHz, row.txHz)}</Table.Td>
                    <Table.Td>
                      <ModePill mode={row.mode as 'fm'} size="xs" />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={row.status === 'add' ? undefined : 'dimmed'}>
                        {previewStatusLabel(row.status)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </PageSection>

        <Group>
          <Button
            leftSection={<IconPlaylistAdd size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            onClick={() => void handleAdd()}
            loading={adding}
            disabled={addCount === 0}
          >
            Add {addCount} channel{addCount === 1 ? '' : 's'}
          </Button>
          <Button component={Link} to="/library/channels" variant="subtle">
            Cancel
          </Button>
        </Group>
      </Stack>
    </FormPage>
  );
}
