import { Checkbox, Group, SimpleGrid, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import BuildListCard, { BuildsListSection } from '../../../components/builds/BuildListCard.tsx';
import { FacetBar, FacetChip, SplitFilter } from '../../../components/library/FacetBar.tsx';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  SegmentedControl,
  ShuttleAddBar,
  ShuttleListPanel,
  ShuttlePoolHeader,
  ShuttlePoolPanel,
  ShuttleRow,
} from '../../../components/v2/index.ts';

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

const CATALOG: Record<string, { label: string; subtitle: string }> = {
  alpha: { label: 'GB3DA Stornoway', subtitle: '145.575 / 145.175 MHz' },
  bravo: { label: 'Highlands zone', subtitle: '8 channels effective' },
  charlie: { label: 'BM Scotland 1', subtitle: '439.275 / 430.875 MHz' },
  delta: { label: 'Local FM net', subtitle: '145.500 / 145.500 MHz' },
  echo: { label: 'GB3IV Inverness', subtitle: '430.950 / 438.950 MHz' },
};

type DemoKey = keyof typeof CATALOG;

export default function StyleguideV2PatternsPage() {
  const [memberKeys, setMemberKeys] = useState<DemoKey[]>(['alpha', 'bravo']);
  const [memberSelection, setMemberSelection] = useState<DemoKey[]>([]);
  const [poolPick, setPoolPick] = useState<DemoKey[]>([]);
  const [facetBands, setFacetBands] = useState<string[]>([]);
  const [facetDuplex, setFacetDuplex] = useState<string | null>(null);
  const [facetDistance, setFacetDistance] = useState(false);
  const [buildGroupMode, setBuildGroupMode] = useState<'radio' | 'list'>('radio');

  const poolKeys = useMemo(
    () => (Object.keys(CATALOG) as DemoKey[]).filter((key) => !memberKeys.includes(key)),
    [memberKeys],
  );

  const toggleMemberSelect = (key: DemoKey) => {
    setMemberSelection((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const togglePoolPick = (key: DemoKey) => {
    setPoolPick((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const addSelected = () => {
    if (!poolPick.length) return;
    setMemberKeys((prev) => [...prev, ...poolPick]);
    setPoolPick([]);
  };

  return (
    <Page width="wide">
      <PageHeader
        title="Patterns"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection
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
      </PageSection>

      <PageSection
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
      </PageSection>

      <PageSection
        title="ShuttleList"
        description="Composes SelectedItemList + AvailableItemPicker; DnD is not reimplemented."
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <ShuttleListPanel
            title="In this zone"
            description={`${memberKeys.length} members — export order`}
            itemKeys={memberKeys}
            selectedKeys={memberSelection}
            onToggleSelect={toggleMemberSelect}
            onRemove={(key) => {
              setMemberKeys((prev) => prev.filter((k) => k !== key));
              setMemberSelection((prev) => prev.filter((k) => k !== key));
            }}
            onReorder={(ordered) => setMemberKeys(ordered)}
            onRemoveSelected={() => {
              const remove = new Set(memberSelection);
              setMemberKeys((prev) => prev.filter((k) => !remove.has(k)));
              setMemberSelection([]);
            }}
            emptyMessage="No members yet"
            renderItem={({ itemKey, selected, onToggleSelect, onRemove, dragHandle }) => {
              const entry = CATALOG[itemKey];
              return (
                <ShuttleRow
                  key={itemKey}
                  label={entry.label}
                  subtitle={entry.subtitle}
                  selected={selected}
                  onToggleSelect={onToggleSelect}
                  onRemove={onRemove}
                  dragHandle={dragHandle}
                />
              );
            }}
          />

          <ShuttlePoolPanel
            header={<ShuttlePoolHeader label="Available" />}
            title="Other items"
            description="Channels and zones not yet in the member list"
            sections={[
              {
                id: 'pool',
                title: 'Items',
                itemKeys: poolKeys,
                selectedKeys: poolPick,
                onToggleSelect: togglePoolPick,
                emptyMessage: 'Nothing left in the pool',
                renderItem: ({ itemKey, checked, onToggle }) => {
                  const entry = CATALOG[itemKey];
                  return (
                    <Group key={itemKey} gap="sm" wrap="nowrap" py={4}>
                      <Checkbox
                        checked={checked}
                        onChange={onToggle}
                        aria-label={`Select ${entry.label}`}
                        size="xs"
                      />
                      <div>
                        <Text size="sm" fw={600}>
                          {entry.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {entry.subtitle}
                        </Text>
                      </div>
                    </Group>
                  );
                },
              },
            ]}
            footer={
              <ShuttleAddBar
                onAdd={addSelected}
                count={poolPick.length}
                disabled={poolPick.length === 0}
              />
            }
          />
        </SimpleGrid>
      </PageSection>
    </Page>
  );
}
