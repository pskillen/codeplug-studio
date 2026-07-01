import { useEffect } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import { useLibrary } from '../state/useLibrary.ts';
import CodeplugMap from '../components/CodeplugMap/CodeplugMap.tsx';
import { scrollToPageSection } from '../lib/scrollToPageSection.ts';
import { EmptyState, ListPage, PageSection } from '../components/ui/index.ts';
import { LIBRARY_KINDS, describeEntity, entitiesForKind } from './library/registry.ts';

export default function LibraryPage() {
  const { library, loading, deleteEntity } = useLibrary();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!scrollTo || loading) return;
    requestAnimationFrame(() => scrollToPageSection(scrollTo));
  }, [location.state, loading]);

  const { skipped: mapSkipped } = applyFilters(library.channels, DEFAULT_MAP_FILTER_OPTS);

  async function handleDelete(kind: LibraryEntityKind, id: string, name: string) {
    if (!window.confirm(`Delete “${name}”?`)) return;
    const outcome = await deleteEntity(kind, id);
    if (!outcome.ok) {
      const where = outcome.references.map((r) => `• ${r.fromName} (${r.relationship})`).join('\n');
      window.alert(`Cannot delete “${name}” — still referenced by:\n\n${where}`);
    }
  }

  function mapPanel() {
    return (
      <Stack gap="xs">
        <CodeplugMap
          channels={library.channels}
          zones={library.zones}
          allChannels={library.channels}
          height={420}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
          onZoneClick={(id) => navigate(`/library/zones/${id}`)}
        />
        {mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map (missing
            coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}
      </Stack>
    );
  }

  return (
    <ListPage
      title="Library"
      description="Curate the vendor-neutral inventory for this project."
      actions={
        <Button component={Link} to="/library/channels/new">
          New channel
        </Button>
      }
    >
      {loading ? (
        <Text>Loading library…</Text>
      ) : (
        LIBRARY_KINDS.map((meta) => {
          const rows = entitiesForKind(library, meta.kind);
          const showMap = meta.kind === 'channel' || meta.kind === 'zone';

          return (
            <PageSection
              key={meta.kind}
              id={`library-${meta.slug}`}
              title={`${meta.plural} (${rows.length})`}
              description={
                meta.kind === 'channel'
                  ? 'Add from scratch or import from a repeater directory via the section nav.'
                  : undefined
              }
            >
              {showMap ? mapPanel() : null}

              {rows.length === 0 ? (
                <EmptyState
                  message={`No ${meta.plural.toLowerCase()} yet.`}
                  action={
                    <Button
                      component={Link}
                      to={`/library/${meta.slug}/new`}
                      variant="light"
                      size="compact-sm"
                    >
                      Add {meta.label.toLowerCase()}
                    </Button>
                  }
                />
              ) : (
                <Stack gap="xs" mt={showMap ? 'md' : undefined}>
                  {rows.map((row) => (
                    <Group
                      key={row.id}
                      justify="space-between"
                      wrap="wrap"
                      p="sm"
                      style={{
                        border: '1px solid var(--mantine-color-dark-4)',
                        borderRadius: 'var(--mantine-radius-md)',
                      }}
                    >
                      <Stack gap={2}>
                        <Text
                          component={Link}
                          to={`/library/${meta.slug}/${row.id}`}
                          fw={600}
                          c="inherit"
                          style={{ textDecoration: 'none' }}
                        >
                          {row.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {describeEntity(library, meta.kind, row.id)}
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <Button
                          component={Link}
                          to={`/library/${meta.slug}/${row.id}`}
                          size="compact-sm"
                          variant="light"
                        >
                          Edit
                        </Button>
                        <Button
                          size="compact-sm"
                          color="red"
                          variant="light"
                          onClick={() => handleDelete(meta.kind, row.id, row.name)}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              )}
            </PageSection>
          );
        })
      )}
    </ListPage>
  );
}
