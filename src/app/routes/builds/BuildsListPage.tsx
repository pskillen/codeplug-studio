import { IconPlus, IconRadio } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, SearchInput } from '../../components/v2/index.ts';
import { Text } from '@mantine/core';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import BuildsByRadio from '../../components/builds/BuildsByRadio.tsx';
import { filterBuildsByQuery, searchTokens } from '../../components/builds/buildsSearch.ts';
import classes from './BuildsListPage.module.css';

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default function BuildsListPage() {
  const { builds, loading } = useFormatBuilds();
  const navigate = useNavigate();
  // Filter-only field: nothing is persisted or fetched, so it filters instantly.
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterBuildsByQuery(builds, query), [builds, query]);
  const radioCount = useMemo(() => new Set(builds.map((b) => b.radioTargetId)).size, [builds]);
  const searching = searchTokens(query).length > 0;

  if (loading) {
    return (
      <div className={classes.page}>
        <Text>Loading builds…</Text>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <div className={classes.headerRow}>
        <div>
          <h1 className={classes.title}>Export for radio</h1>
          <p className={classes.subtitle}>
            Each build is one way of loading your library into one radio — wire names, layout, and
            export pathway. {builds.length} {builds.length === 1 ? 'build' : 'builds'} across{' '}
            {radioCount} {radioCount === 1 ? 'radio' : 'radios'}.
          </p>
        </div>
        <div className={classes.headerActions}>
          <Button
            className={classes.newBuild}
            variant="primary"
            onClick={() => navigate('/builds/new')}
            leftSection={<IconPlus size={16} stroke={1.75} />}
          >
            New build
          </Button>
        </div>
      </div>

      {builds.length === 0 ? (
        <EmptyState
          icon={<IconRadio size={20} stroke={1.75} />}
          title="No builds yet"
          description="Create a build for the radio you are programming. You can keep several builds for the same radio type (Team A / Team B)."
          action={
            <Button variant="primary" onClick={() => navigate('/builds/new')}>
              New build
            </Button>
          }
        />
      ) : (
        <>
          <div className={classes.toolbar}>
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search name, radio, firmware, transfer path…"
              aria-label="Search builds"
              className={classes.search}
            />
            {searching ? (
              <span className={classes.matchCount} role="status">
                {plural(filtered.length, 'match', 'matches')}
              </span>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <Text size="sm" c="dimmed">
              No builds match “{query.trim()}”.
            </Text>
          ) : (
            <BuildsByRadio builds={filtered} query={query} />
          )}
        </>
      )}
    </div>
  );
}
