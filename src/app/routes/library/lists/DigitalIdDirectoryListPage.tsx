import { useEffect, useMemo, useState } from 'react';
import { Group, Pagination } from '@mantine/core';
import { IconId, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalIdDirectoryOrderBy } from '@integrations/persistence/index.ts';
import DigitalIdDirectoryDetailDrawer from '../../../components/contacts/DigitalIdDirectoryDetailDrawer.tsx';
import ClearDigitalIdDirectoryDialog, {
  type ClearDigitalIdDirectoryMode,
} from '../../../components/contacts/ClearDigitalIdDirectoryDialog.tsx';
import DigitalIdDirectoryInterchangeToolbar from '../../../components/contacts/DigitalIdDirectoryInterchangeToolbar.tsx';
import CountryComboboxField from '../../../components/directories/CountryComboboxField.tsx';
import pageClasses from '../../../components/directories/DirectoryIngestPage.module.css';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  EmptyState,
  FormField,
  Panel,
  StatusBanner,
  TextInput,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import { useDigitalIdDirectoryPage } from '../../../hooks/useDigitalIdDirectoryPage.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useProjects } from '../../../state/useProjects.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { persistence } from '../../../state/persistence.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';

const PAGE_SIZE = 50;

const ORDER_BY_KEYS = new Set<string>(['digitalId', 'callsign', 'name']);

export default function DigitalIdDirectoryListPage() {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const { library, reload } = useLibrary();
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState<DigitalIdDirectoryOrderBy>('name');
  const [callsignPrefix, setCallsignPrefix] = useState('');
  const [namePrefix, setNamePrefix] = useState('');
  const [digitalIdPrefix, setDigitalIdPrefix] = useState('');
  const [countryEquals, setCountryEquals] = useState('');
  const [detailEntry, setDetailEntry] = useState<DigitalIdDirectoryEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearMode, setClearMode] = useState<ClearDigitalIdDirectoryMode>('all');
  const [partitionCount, setPartitionCount] = useState(0);

  const filters = useMemo(
    () => ({
      digitalIdPrefix: digitalIdPrefix.trim() || undefined,
      callsignPrefix: callsignPrefix.trim() || undefined,
      namePrefix: namePrefix.trim() || undefined,
      countryEquals: countryEquals.trim() || undefined,
    }),
    [digitalIdPrefix, callsignPrefix, namePrefix, countryEquals],
  );

  const hasFilters =
    filters.digitalIdPrefix !== undefined ||
    filters.callsignPrefix !== undefined ||
    filters.namePrefix !== undefined ||
    filters.countryEquals !== undefined;

  const { rows, total, loading, error, pageCount } = useDigitalIdDirectoryPage(activeProjectId, {
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    filters,
  });

  useEffect(() => {
    if (!activeProjectId) {
      setPartitionCount(0);
      return;
    }
    const projectId = activeProjectId;

    async function loadPartitionCount() {
      const count = await persistence.countDigitalIdDirectoryEntries(projectId);
      setPartitionCount(count);
    }

    void loadPartitionCount();
    const unsubscribe = persistence.subscribeDirectory((change) => {
      if (change.projectId === projectId) void loadPartitionCount();
    });

    return () => unsubscribe();
  }, [activeProjectId]);

  function openClearDialog(mode: ClearDigitalIdDirectoryMode) {
    setClearMode(mode);
    setClearOpen(true);
  }

  const columns = useMemo((): DataTableColumn<DigitalIdDirectoryEntry>[] => {
    return [
      {
        key: 'digitalId',
        header: 'ID',
        render: (row) => row.digitalId,
        sortValue: (row) => row.digitalId,
        width: '100px',
      },
      {
        key: 'callsign',
        header: 'Callsign',
        hideOnMobile: true,
        render: (row) => row.callsign || '—',
        sortValue: (row) => row.callsign || '',
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name || '—',
        sortValue: (row) => row.name || '',
      },
      {
        key: 'city',
        header: 'City',
        hideOnMobile: true,
        render: (row) => row.city || '—',
        sortValue: (row) => row.city || '',
      },
      {
        key: 'state',
        header: 'State',
        hideOnMobile: true,
        render: (row) => row.state || '—',
        sortValue: (row) => row.state || '',
      },
      {
        key: 'country',
        header: 'Country',
        render: (row) => row.country || '—',
        sortValue: (row) => row.country || '',
      },
    ];
  }, []);

  const listActions = (
    <Button
      variant="secondary"
      leftSection={<IconId size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => navigate('/library/contacts/add-from-radioid')}
    >
      Fetch from RadioID.net
    </Button>
  );

  const tableCaption =
    total > PAGE_SIZE ? (
      <Group justify="space-between" wrap="wrap" gap="sm">
        <span>
          {total.toLocaleString()} IDs — page {page} of {pageCount}
        </span>
        <Pagination total={pageCount} value={page} onChange={setPage} size="sm" />
      </Group>
    ) : (
      'Read-only shadow store — copy rows into library contacts when you need them on channels or export.'
    );

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader
          title="Digital ID directory"
          subtitle={
            loading && total === 0
              ? 'Loading directory…'
              : `${total.toLocaleString()} downloaded ID${total === 1 ? '' : 's'} in local shadow store`
          }
          actions={listActions}
        />

        <p className={classes.subtitle} style={{ marginBottom: 16 }}>
          Bulk RadioID.net import lands here first. Library contacts below{' '}
          <button
            type="button"
            className="libraryListNameLink"
            onClick={() => navigate('/library/contacts')}
          >
            Contacts
          </button>{' '}
          are curated rows you edit and reference from channels.
        </p>

        {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}

        <DigitalIdDirectoryInterchangeToolbar
          projectId={activeProjectId}
          onImported={() => {
            setPage(1);
          }}
        />

        {total === 0 && !loading && !hasFilters ? (
          <EmptyState
            title="No directory IDs yet"
            description="Search RadioID.net and import DMR user listings into your local directory shadow store. Copy individual IDs into library contacts when you need them on channels or export."
            action={
              <Button
                leftSection={<IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                onClick={() => navigate('/library/contacts/add-from-radioid')}
              >
                Fetch from RadioID.net
              </Button>
            }
          />
        ) : (
          <Panel title={`Directory rows (${total.toLocaleString()})`}>
            <div className={classes.toolbarActions} style={{ marginBottom: 12 }}>
              <Button
                variant="ghost"
                size="sm"
                disabled={partitionCount === 0}
                onClick={() => openClearDialog('all')}
              >
                Clear directory
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasFilters || total === 0}
                onClick={() => openClearDialog('filtered')}
              >
                Delete matching filters ({total.toLocaleString()})
              </Button>
            </div>
            <div className={pageClasses.filterGrid} style={{ marginBottom: 12 }}>
              <CountryComboboxField
                label="Country"
                value={countryEquals}
                onChange={(value) => {
                  setCountryEquals(value);
                  setPage(1);
                }}
                className={pageClasses.filterField}
              />
              <FormField label="ID begins with" className={pageClasses.filterField}>
                <TextInput
                  variant="plain"
                  value={digitalIdPrefix}
                  onChange={(e) => {
                    setDigitalIdPrefix(e.currentTarget.value);
                    setPage(1);
                  }}
                  placeholder="e.g. 3109"
                  inputMode="numeric"
                />
              </FormField>
              <FormField label="Callsign begins with" className={pageClasses.filterField}>
                <TextInput
                  variant="plain"
                  value={callsignPrefix}
                  onChange={(e) => {
                    setCallsignPrefix(e.currentTarget.value);
                    setPage(1);
                  }}
                  placeholder="e.g. M0"
                />
              </FormField>
              <FormField label="Name begins with" className={pageClasses.filterField}>
                <TextInput
                  variant="plain"
                  value={namePrefix}
                  onChange={(e) => {
                    setNamePrefix(e.currentTarget.value);
                    setPage(1);
                  }}
                  placeholder="Filter display name…"
                />
              </FormField>
            </div>

            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.digitalId)}
              scale="extreme"
              totalRowCount={total}
              caption={tableCaption}
              sort={{ key: orderBy, direction: 'asc' }}
              onSortChange={(next) => {
                if (next && ORDER_BY_KEYS.has(next.key)) {
                  setOrderBy(next.key as DigitalIdDirectoryOrderBy);
                  setPage(1);
                }
              }}
              emptyMessage="No directory rows match your filters."
              filteredEmptyMessage={
                hasFilters ? 'No directory rows match your filters.' : 'No directory rows yet.'
              }
              onRowActivate={(row) => {
                setDetailEntry(row);
                setDetailOpen(true);
              }}
            />

            {loading ? (
              <p className={pageClasses.attribution} style={{ marginTop: 8 }}>
                Loading…
              </p>
            ) : null}
          </Panel>
        )}
        <DigitalIdDirectoryDetailDrawer
          entry={detailEntry}
          libraryContacts={library.digitalContacts}
          opened={detailOpen}
          onClose={() => setDetailOpen(false)}
          onCopied={() => void reload()}
        />

        <ClearDigitalIdDirectoryDialog
          opened={clearOpen}
          onClose={() => setClearOpen(false)}
          mode={clearMode}
          entryCount={clearMode === 'filtered' ? total : partitionCount}
          onConfirm={async () => {
            if (!activeProjectId) return { deletedCount: 0 };
            if (clearMode === 'filtered') {
              return persistence.deleteDigitalIdDirectoryMatching({
                projectId: activeProjectId,
                ...filters,
              });
            }
            return persistence.deleteDigitalIdDirectoryForProject(activeProjectId);
          }}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
