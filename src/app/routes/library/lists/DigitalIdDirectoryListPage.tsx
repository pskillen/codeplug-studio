import { useMemo, useState } from 'react';
import { Group, Pagination } from '@mantine/core';
import { IconId, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalIdDirectoryOrderBy } from '@integrations/persistence/index.ts';
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
  type DataTableSortState,
} from '../../../components/v2/index.ts';
import { useDigitalIdDirectoryPage } from '../../../hooks/useDigitalIdDirectoryPage.ts';
import { v1SortToV2, v2SortToV1 } from '../../../lib/libraryListTable.tsx';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useProjects } from '../../../state/useProjects.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';

const PAGE_SIZE = 50;

const ORDER_BY_KEYS = new Set<string>(['digitalId', 'callsign', 'name']);

function sortToOrderBy(sort: DataTableSortState | null): DigitalIdDirectoryOrderBy {
  if (sort && ORDER_BY_KEYS.has(sort.key)) {
    return sort.key as DigitalIdDirectoryOrderBy;
  }
  return 'name';
}

function orderByToSort(orderBy: DigitalIdDirectoryOrderBy): DataTableSortState {
  return { key: orderBy, direction: 'asc' };
}

export default function DigitalIdDirectoryListPage() {
  const navigate = useNavigate();
  const { activeProjectId } = useProjects();
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState<DigitalIdDirectoryOrderBy>('name');
  const [callsignPrefix, setCallsignPrefix] = useState('');
  const [namePrefix, setNamePrefix] = useState('');
  const [countryEquals, setCountryEquals] = useState('');

  const filters = useMemo(
    () => ({
      callsignPrefix: callsignPrefix.trim() || undefined,
      namePrefix: namePrefix.trim() || undefined,
      countryEquals: countryEquals.trim() || undefined,
    }),
    [callsignPrefix, namePrefix, countryEquals],
  );

  const hasFilters =
    filters.callsignPrefix !== undefined ||
    filters.namePrefix !== undefined ||
    filters.countryEquals !== undefined;

  const { rows, total, loading, error, pageCount } = useDigitalIdDirectoryPage(activeProjectId, {
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    filters,
  });

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
              sort={v1SortToV2(orderByToSort(orderBy))}
              onSortChange={(next) => {
                const v1 = v2SortToV1(next);
                if (v1 && ORDER_BY_KEYS.has(v1.columnKey)) {
                  setOrderBy(v1.columnKey as DigitalIdDirectoryOrderBy);
                  setPage(1);
                }
              }}
              emptyMessage="No directory rows match your filters."
              filteredEmptyMessage={
                hasFilters ? 'No directory rows match your filters.' : 'No directory rows yet.'
              }
            />

            {loading ? (
              <p className={pageClasses.attribution} style={{ marginTop: 8 }}>
                Loading…
              </p>
            ) : null}
          </Panel>
        )}
      </div>
    </DesignSystemV2Provider>
  );
}
