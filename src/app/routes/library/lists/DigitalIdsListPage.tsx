import { useMemo, useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import type { OwnDigitalId, OwnDigitalIdProtocol } from '@core/models/library.ts';
import {
  OWN_DIGITAL_ID_PROTOCOLS,
  ownDigitalIdLabel,
  ownDigitalIdProtocolLabel,
  ownDigitalIdWarnings,
} from '@core/domain/ownDigitalIds.ts';
import EntityListRowDeleteAction from '../../../components/library/EntityListRowDeleteAction.tsx';
import LibraryInventoryHeader from '../../../components/library/LibraryInventoryHeader.tsx';
import {
  Button,
  DataTable,
  DesignSystemV2Provider,
  StatusBanner,
  type DataTableColumn,
} from '../../../components/v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import {
  buildReferenceCountIndex,
  formatReferenceCount,
  referenceCountFromIndex,
} from '../../../lib/listReferences.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import classes from '../../../components/library/LibraryInventoryPage.module.css';

const SUBTITLE = 'Your own DMR and NXDN IDs: the IDs your radio sends.';
const CAPTION =
  'Your own IDs. People and groups you call are in Contacts and Talk groups; the downloaded lookup list is the ID directory.';

export default function DigitalIdsListPage() {
  const navigate = useNavigate();
  const { library, loading, setDefaultOwnDigitalId } = useLibrary();
  const [actionError, setActionError] = useState<string | null>(null);
  const { ownDigitalIds } = library;
  const referenceIndex = useMemo(() => buildReferenceCountIndex(library), [library]);
  const warnings = useMemo(() => ownDigitalIdWarnings(ownDigitalIds), [ownDigitalIds]);

  async function makeDefault(row: OwnDigitalId) {
    setActionError(null);
    try {
      await setDefaultOwnDigitalId(row.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not set the default.');
    }
  }

  const columns = useMemo((): DataTableColumn<OwnDigitalId>[] => {
    return [
      {
        key: 'name',
        header: 'Name',
        render: (row) =>
          row.name.trim() ? (
            <Link className="libraryListNameLink" to={`/library/digital-ids/${row.id}`}>
              {row.name}
            </Link>
          ) : (
            <Link className="libraryListNameLink" to={`/library/digital-ids/${row.id}`}>
              <span style={{ opacity: 0.7 }}>{ownDigitalIdLabel(row)}</span>
              <span style={{ opacity: 0.7 }}> · Add a name</span>
            </Link>
          ),
      },
      {
        key: 'number',
        header: 'ID',
        render: (row) => row.number,
        sortValue: (row) => row.number,
      },
      {
        key: 'default',
        header: 'Default',
        render: (row) =>
          row.isDefault ? (
            <strong>Default</strong>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void makeDefault(row)}>
              Set as default
            </Button>
          ),
      },
      {
        key: 'usage',
        header: 'Channels using',
        render: (row) =>
          formatReferenceCount(
            referenceCountFromIndex(referenceIndex, { kind: 'ownDigitalId', id: row.id }),
          ),
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        width: '52px',
        render: (row) => (
          <EntityListRowDeleteAction
            kind="ownDigitalId"
            entityId={row.id}
            label={ownDigitalIdLabel(row)}
          />
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- makeDefault only closes over stable setters
  }, [referenceIndex]);

  const listActions = (
    <Button
      variant="primary"
      leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => navigate('/library/digital-ids/new')}
    >
      New Digital ID
    </Button>
  );

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.page}>
          <LibraryInventoryHeader title="Digital IDs" subtitle="Loading library…" />
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <LibraryInventoryHeader title="Digital IDs" subtitle={SUBTITLE} actions={listActions} />
        <p className={classes.subtitle}>{CAPTION}</p>

        {actionError ? <StatusBanner tone="warning">{actionError}</StatusBanner> : null}
        {warnings.map((warning) => (
          <StatusBanner key={warning} tone="warning">
            {warning}
          </StatusBanner>
        ))}

        {ownDigitalIds.length === 0 ? (
          <p className={classes.subtitle} style={{ marginTop: 16 }}>
            Add your DMR ID and, if you use NXDN, your NXDN ID.
          </p>
        ) : null}

        {OWN_DIGITAL_ID_PROTOCOLS.map((protocol: OwnDigitalIdProtocol) => {
          const rows = ownDigitalIds
            .filter((row) => row.protocol === protocol)
            .sort((a, b) => a.number - b.number);
          if (rows.length === 0) return null;
          const label = ownDigitalIdProtocolLabel(protocol);
          return (
            <section key={protocol} aria-label={`${label} IDs`}>
              <h2 className={classes.sectionTitle}>{label}</h2>
              <DataTable
                columns={columns}
                rows={rows}
                getRowId={(row) => row.id}
                emptyMessage={`No ${label} IDs.`}
              />
            </section>
          );
        })}
      </div>
    </DesignSystemV2Provider>
  );
}
