import { Group, SimpleGrid, Text } from '@mantine/core';
import { useState } from 'react';
import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import BuildListCard, { BuildsListSection } from '../../components/builds/BuildListCard.tsx';
import { FacetBar, FacetChip, SplitFilter } from '../../components/library/FacetBar.tsx';
import NextPassCard from '../../components/NextPassCard/NextPassCard.tsx';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';
import { SegmentedControl } from '../../components/v2/index.ts';

const DEMO_BUILDS = (() => {
  const mini = newRadioBuildForProfile('styleguide-demo', 'radio-io-uv5r-mini');
  const dm1701 = newRadioBuildForProfile('styleguide-demo', 'opengd77-1701');
  const olderUpdatedAt = new Date(Date.parse(mini.build.updatedAt) - 86400000).toISOString();
  return [
    { ...mini.build, id: 'styleguide-build-mini-a', name: 'UV-5R Team A' },
    {
      ...mini.build,
      id: 'styleguide-build-mini-b',
      name: 'UV-5R Team B',
      updatedAt: olderUpdatedAt,
    },
    { ...dm1701.build, id: 'styleguide-build-dm1701', name: 'DM-1701 field kit' },
  ];
})();

const NEXT_PASS_DEMO_NOW_MS = Date.now();

const UPCOMING_PASS_DEMO: PassResult = {
  aosAt: new Date(NEXT_PASS_DEMO_NOW_MS + 8 * 60 * 1000).toISOString(),
  losAt: new Date(NEXT_PASS_DEMO_NOW_MS + 18 * 60 * 1000).toISOString(),
  maxElevationAt: new Date(NEXT_PASS_DEMO_NOW_MS + 13 * 60 * 1000).toISOString(),
  maxElevationDeg: 38.4,
  durationSec: 600,
};

const ACTIVE_PASS_DEMO: PassResult = {
  aosAt: new Date(NEXT_PASS_DEMO_NOW_MS - 3 * 60 * 1000).toISOString(),
  losAt: new Date(NEXT_PASS_DEMO_NOW_MS + 4 * 60 * 1000).toISOString(),
  maxElevationAt: new Date(NEXT_PASS_DEMO_NOW_MS - 1 * 60 * 1000).toISOString(),
  maxElevationDeg: 61.2,
  durationSec: 420,
};

export default function StyleguidePatternsPage() {
  const [facetBands, setFacetBands] = useState<string[]>([]);
  const [facetDuplex, setFacetDuplex] = useState<string | null>(null);
  const [facetDistance, setFacetDistance] = useState(false);
  const [buildGroupMode, setBuildGroupMode] = useState<'radio' | 'list'>('radio');

  return (
    <StyleguidePageShell title="Patterns" description="Product-specific compositions built from v2 primitives.">
      <StyleguideSection
        title="FacetBar"
        description="Library list filter chips and split pill (Channels list). Click an active split option again to clear the filter."
      >
        <FacetBar scrollable>
          <FacetChip
            label="All bands"
            active={facetBands.length === 0}
            onClick={() => setFacetBands([])}
          />
          <FacetChip
            label="2m"
            active={facetBands.includes('2m')}
            onClick={() =>
              setFacetBands((prev) =>
                prev.includes('2m') ? prev.filter((id) => id !== '2m') : [...prev, '2m'],
              )
            }
          />
          <FacetChip
            label="70cm"
            active={facetBands.includes('70cm')}
            onClick={() =>
              setFacetBands((prev) =>
                prev.includes('70cm') ? prev.filter((id) => id !== '70cm') : [...prev, '70cm'],
              )
            }
          />
          <SplitFilter
            options={[
              { value: 'simplex', label: 'Simplex' },
              { value: 'split', label: 'Split' },
            ]}
            value={facetDuplex}
            onChange={setFacetDuplex}
          />
          <FacetChip
            label="Within 25 km"
            active={facetDistance}
            onClick={() => setFacetDistance((prev) => !prev)}
          />
        </FacetBar>
        <Text size="sm" c="dimmed">
          Duplex filter: {facetDuplex ?? 'none'}
        </Text>
      </StyleguideSection>

      <StyleguideSection
        title="Export for radio — build card"
        description="Grouped build list cards on Export for radio (B0). Pathway pills summarise compatible egress; card links to the build export front door."
      >
        <Group gap="md" align="center" mb="sm">
          <SegmentedControl
            size="md"
            value={buildGroupMode}
            onChange={(value) => setBuildGroupMode(value as 'radio' | 'list')}
            options={[
              { value: 'radio', label: 'By radio' },
              { value: 'list', label: 'List' },
            ]}
          />
          <Text size="sm" c="dimmed">
            Group mode (list view uses DataTable elsewhere)
          </Text>
        </Group>
        {buildGroupMode === 'radio' ? (
          <BuildsListSection title="Baofeng UV-5R Mini">
            {DEMO_BUILDS.filter((b) => b.radioTargetId === 'baofeng-uv5r-mini').map((build) => (
              <BuildListCard key={build.id} build={build} />
            ))}
          </BuildsListSection>
        ) : (
          <BuildsListSection title="All builds">
            {DEMO_BUILDS.map((build) => (
              <BuildListCard key={build.id} build={build} />
            ))}
          </BuildsListSection>
        )}
      </StyleguideSection>

      <StyleguideSection
        title="Satellite tracking — next pass card"
        description="Highlighted next-pass summary for the satellite detail page."
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <NextPassCard
            satelliteName="AO-91"
            nextPass={UPCOMING_PASS_DEMO}
            nowMs={NEXT_PASS_DEMO_NOW_MS}
            hasObserver
            transmitters={[
              {
                id: 'demo-ao91-fm-repeater',
                label: 'FM repeater',
                mode: 'FM',
                uplinkHz: 435_250_000,
                downlinkHz: 145_960_000,
                uplinkToneHz: null,
                downlinkToneHz: null,
              },
            ]}
          />
          <NextPassCard
            satelliteName="AO-91"
            nextPass={ACTIVE_PASS_DEMO}
            nowMs={NEXT_PASS_DEMO_NOW_MS}
            hasObserver
            transmitters={[
              {
                id: 'demo-ao91-fm-repeater',
                label: 'FM repeater',
                mode: 'FM',
                uplinkHz: 435_250_000,
                downlinkHz: 145_960_000,
                uplinkToneHz: null,
                downlinkToneHz: null,
                dopplerUplinkHz: 435_240_600,
                dopplerDownlinkHz: 145_963_400,
              },
            ]}
          />
        </SimpleGrid>
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
