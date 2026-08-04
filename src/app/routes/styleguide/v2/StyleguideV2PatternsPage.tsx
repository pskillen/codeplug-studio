import { Checkbox, Group, SimpleGrid, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  ShuttleAddBar,
  ShuttleListPanel,
  ShuttlePoolHeader,
  ShuttlePoolPanel,
  ShuttleRow,
} from '../../../components/v2/index.ts';

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
