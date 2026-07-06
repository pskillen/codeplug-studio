import { Group, Tabs, type MantineSpacing } from '@mantine/core';
import type { ReactNode } from 'react';

export interface PillTabsItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Optional badge or pill shown before the label (e.g. `ModePill`). */
  leading?: ReactNode;
  panel: ReactNode;
}

export interface PillTabsProps<T extends string = string> {
  items: readonly PillTabsItem<T>[];
  defaultValue?: T;
  value?: T;
  onChange?: (value: T) => void;
  panelPt?: MantineSpacing;
  emptyState?: ReactNode;
}

export default function PillTabs<T extends string>({
  items,
  defaultValue,
  value,
  onChange,
  panelPt = 'md',
  emptyState = null,
}: PillTabsProps<T>) {
  if (items.length === 0) {
    return emptyState;
  }

  const initial = defaultValue ?? items[0]?.value;

  return (
    <Tabs
      value={value}
      defaultValue={value == null ? initial : undefined}
      onChange={(next) => {
        if (next != null) onChange?.(next as T);
      }}
    >
      <Tabs.List>
        {items.map((item) => (
          <Tabs.Tab key={item.value} value={item.value}>
            <Group gap={6} wrap="nowrap">
              {item.leading}
              {item.label}
            </Group>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {items.map((item) => (
        <Tabs.Panel key={item.value} value={item.value} pt={panelPt}>
          {item.panel}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
