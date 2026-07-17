import { Button, Checkbox, Group, Text } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AvailableItemPicker,
  Page,
  PageHeader,
  PageSection,
  SelectedItemList,
} from '../../components/ui/index.ts';
import MembershipListsDemo from './MembershipListsDemo.tsx';

export default function StyleguideMembershipPage() {
  const [cKeys, setCKeys] = useState(['m1', 'm2', 'm3']);
  const [cSelected, setCSelected] = useState<string[]>([]);
  const [cFilter, setCFilter] = useState('');
  const [bPick, setBPick] = useState<string[]>([]);
  const [bFilter, setBFilter] = useState('');
  const pool = ['p1', 'p2', 'p3', 'p4'].filter((k) => !cKeys.includes(k));

  const filteredC = cKeys.filter((k) => !cFilter || k.includes(cFilter.toLowerCase()));
  const filteredPool = pool.filter((k) => !bFilter || k.includes(bFilter.toLowerCase()));

  const move = (direction: 'up' | 'down') => {
    setCKeys((prev) => {
      const next = [...prev];
      const indices = cSelected
        .map((key) => next.indexOf(key))
        .filter((i) => i >= 0)
        .sort((a, b) => (direction === 'up' ? a - b : b - a));
      for (const index of indices) {
        const swapWith = direction === 'up' ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= next.length) continue;
        if (cSelected.includes(next[swapWith]!)) continue;
        [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
      }
      return next;
    });
  };

  return (
    <Page width="default">
      <PageHeader
        title="Styleguide — membership"
        description={
          <>
            <Link to="/styleguide">← Styleguide</Link> · Roles B (picker) and C (membership list)
          </>
        }
      />

      <PageSection
        title="Paired B + C (zone pick-members pattern)"
        description="Interactive add → reorder → remove without library models. Favourite reference for membership UIs."
      >
        <MembershipListsDemo />
      </PageSection>

      <PageSection
        title="SelectedItemList — standalone (C)"
        description="Built-in move/remove + filter; membership prop slot via renderItem."
      >
        <SelectedItemList
          title="Members"
          description={`${cKeys.length} items`}
          filter={{ value: cFilter, onChange: setCFilter }}
          itemKeys={filteredC}
          selectedKeys={cSelected}
          onToggleSelect={(key) =>
            setCSelected((prev) =>
              prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
            )
          }
          onRemove={(key) => {
            setCKeys((prev) => prev.filter((x) => x !== key));
            setCSelected((prev) => prev.filter((x) => x !== key));
          }}
          onMoveSelected={move}
          onRemoveSelected={() => {
            const remove = new Set(cSelected);
            setCKeys((prev) => prev.filter((k) => !remove.has(k)));
            setCSelected([]);
          }}
          canMoveUp={cSelected.some((k) => cKeys.indexOf(k) > 0)}
          canMoveDown={cSelected.some((k) => {
            const i = cKeys.indexOf(k);
            return i >= 0 && i < cKeys.length - 1;
          })}
          emptyMessage="No members"
          renderItem={({ itemKey, selected, onToggleSelect, onRemove }) => (
            <Group key={itemKey} gap="sm">
              <Checkbox
                checked={selected}
                onChange={onToggleSelect}
                aria-label={`Select ${itemKey}`}
              />
              <Text size="sm" style={{ flex: 1 }}>
                {itemKey}
              </Text>
              <Checkbox label="Prop" size="xs" defaultChecked />
              <Button size="compact-xs" variant="subtle" color="red" onClick={onRemove}>
                Remove
              </Button>
            </Group>
          )}
        />
      </PageSection>

      <PageSection
        title="AvailableItemPicker — standalone (B)"
        description="Sparse rows, description, sectionToolbar select-all, footer slot."
      >
        <AvailableItemPicker
          title="Available"
          description={`${filteredPool.length} candidates`}
          filter={{ value: bFilter, onChange: setBFilter }}
          sections={[
            {
              id: 'pool',
              title: 'Items',
              itemKeys: filteredPool,
              selectedKeys: bPick,
              onToggleSelect: (key) =>
                setBPick((prev) =>
                  prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
                ),
              sectionToolbar: (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  disabled={!filteredPool.length}
                  onClick={() => setBPick([...filteredPool])}
                >
                  Select all
                </Button>
              ),
              emptyMessage: 'Nothing left',
              renderItem: ({ itemKey, checked, onToggle }) => (
                <Checkbox key={itemKey} label={itemKey} checked={checked} onChange={onToggle} />
              ),
            },
          ]}
          onAddSelected={() => {
            setCKeys((prev) => [...prev, ...bPick]);
            setBPick([]);
          }}
          addDisabled={!bPick.length}
          footer={
            <Text size="xs" c="dimmed">
              Footer slot
            </Text>
          }
        />
      </PageSection>
    </Page>
  );
}
