import { DebugSection } from '@app/components/debug/index.ts';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import {
  radioFoundryIdDatabaseView,
  type RadioFoundryIdDatabaseView,
} from '@integrations/radio-io/radios/radiofoundry/debugIdDatabase.ts';
import { Alert, Button, Group, NativeSelect, NumberInput, Stack, Text, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import type { DebugArchive } from './captureArchive.ts';
import { memoByArchive } from './archiveMemo.ts';

const PAGE_SIZE = 100;
const LOOKUP_DEBOUNCE_MS = 250;

const projectIdDatabase = memoByArchive((archive: DebugArchive) =>
  radioFoundryIdDatabaseView({
    manifest: archive.manifest,
    regions: archive.regions,
    sidecars: archive.sidecars,
  }),
);

interface RecordRow {
  id: string;
  index: number;
  recordIndex: number;
  dmrId: number;
  text: string;
}

const recordColumns: DataTableColumn<RecordRow>[] = [
  {
    key: 'index',
    header: 'Record',
    width: '6rem',
    render: (r) => r.index + 1,
  },
  {
    key: 'id',
    header: 'DMR ID',
    width: '8rem',
    render: (r) => r.dmrId,
  },
  {
    key: 'text',
    header: 'Text',
    width: 'minmax(14rem, 3fr)',
    render: (r) => r.text,
  },
];

function RecordsTable({ view }: { view: Extract<RadioFoundryIdDatabaseView, { status: 'ok' }> }) {
  const [page, setPage] = useState(0);
  const rows: RecordRow[] = [];
  for (let i = 0; i < view.headerCount; i += 1) {
    const rec = view.record(i);
    if (!rec) break;
    rows.push({
      id: `rec-${i}`,
      index: rows.length,
      recordIndex: i,
      dmrId: rec.id,
      text: rec.text,
    });
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  return (
    <Stack gap="sm">
      <DataTable
        caption="DMR ID database records"
        variant="embedded"
        columns={recordColumns}
        rows={slice}
        getRowId={(r) => r.id}
        emptyMessage="No records were decoded in the captured bytes."
      />
      {pages > 1 && (
        <Group gap="sm">
          <Button
            variant="default"
            disabled={current <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Text size="sm">
            Page {current + 1} of {pages}
          </Text>
          <Button
            variant="default"
            disabled={current >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          >
            Next
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function LookupBox({ view }: { view: Extract<RadioFoundryIdDatabaseView, { status: 'ok' }> }) {
  const [draft, setDraft] = useState<string>('');
  const [debounced] = useDebouncedValue(draft, LOOKUP_DEBOUNCE_MS);
  const parsed = debounced.trim() === '' ? NaN : Number(debounced);
  const result = useMemo(() => {
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return view.lookup(Math.trunc(parsed));
  }, [parsed, view]);
  return (
    <Stack gap="xs">
      <NumberInput
        label="DMR ID"
        description="Lookup in the captured records only."
        value={draft === '' ? '' : Number(draft)}
        onChange={(v) => setDraft(v === '' ? '' : String(v))}
        allowDecimal={false}
        allowNegative={false}
        hideControls
      />
      {result && 'found' in result && result.found && (
        <Text size="sm">
          Found at record {result.index + 1}: {result.text}
        </Text>
      )}
      {result && 'found' in result && !result.found && result.nearest && (
        <Text size="sm">
          Not found. Nearest ID {result.nearest.id} at record {result.nearest.index + 1}.
        </Text>
      )}
      {result && 'notCaptured' in result && (
        <Text size="sm">That ID would lie past the captured area 2 bytes.</Text>
      )}
    </Stack>
  );
}

function HeaderSection({ view }: { view: RadioFoundryIdDatabaseView }) {
  if (view.status === 'not-captured') {
    return (
      <Alert color="yellow" title="Not captured">
        The flash-image region was not captured, so the ID database header cannot be read.
      </Alert>
    );
  }
  if (view.status === 'none') {
    return <Text size="sm">No ID database (header {view.headerHex}).</Text>;
  }
  if (view.status === 'compact') {
    return <Text size="sm">Compact format (C). Not decoded yet. Header {view.headerHex}.</Text>;
  }
  if (view.status === 'voice-prompt-area2') {
    return (
      <Text size="sm">
        Format n: area 2 is in the voice-prompt area (image 0x
        {view.area2Address.toString(16).toUpperCase()}), not at 0xD8000. This read does not take
        that area, so the view does not decode it. Header count {view.headerCount.toLocaleString()}.
      </Text>
    );
  }
  if (view.status === 'unreadable') {
    return (
      <Alert color="yellow" title="Unreadable header">
        {view.reason}
      </Alert>
    );
  }
  const radioCount =
    view.radio?.records != null ? view.radio.records.toLocaleString() : 'Not reported';
  const area2Text =
    view.area2Records === 'not-captured'
      ? "Not captured: tick 'Also read the DMR ID database area 2' and read again"
      : view.area2Records.toLocaleString();
  return (
    <Stack gap="xs">
      <Text size="sm">Format: {view.format}</Text>
      <Text size="sm">Header record count: {view.headerCount.toLocaleString()}</Text>
      <Text size="sm">Radio-reported record count: {radioCount}</Text>
      <Text size="sm">Records in area 1: {view.area1Records.toLocaleString()}</Text>
      <Text size="sm">Records in area 2: {area2Text}</Text>
      <Text size="sm">The radio reads this database: {view.radioReadsIt ? 'yes' : 'no'}</Text>
    </Stack>
  );
}

function IntegritySection({
  view,
}: {
  view: Extract<RadioFoundryIdDatabaseView, { status: 'ok' }>;
}) {
  return (
    <Stack gap="xs">
      {view.integrity.ascending ? (
        <Text size="sm">IDs ascend across both areas.</Text>
      ) : (
        <Text size="sm">
          IDs stop ascending at record {view.integrity.firstBreak!.index + 1} (ID{' '}
          {view.integrity.firstBreak!.id} after {view.integrity.firstBreak!.previous}).
        </Text>
      )}
      {view.integrity.blankRecords > 0 && (
        <Text size="sm">
          {view.integrity.blankRecords.toLocaleString()} blank records counted by the header among
          the captured bytes.
        </Text>
      )}
    </Stack>
  );
}

export function RadioFoundryIdDatabasePanel({ archive }: { archive: DebugArchive }) {
  const view = useMemo(() => projectIdDatabase(archive), [archive]);
  return (
    <Stack gap="md">
      <DebugSection title="Header and counts">
        <HeaderSection view={view} />
      </DebugSection>
      {view.status === 'ok' && (
        <>
          <DebugSection title="Integrity">
            <IntegritySection view={view} />
          </DebugSection>
          <DebugSection title="Lookup">
            <LookupBox view={view} />
          </DebugSection>
          <DebugSection title="Records">
            <RecordsTable view={view} />
          </DebugSection>
        </>
      )}
    </Stack>
  );
}
