import { Group, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import type { ReactNode } from 'react';

export interface SelectedItemListFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}

export interface SelectedItemListRenderProps<TKey extends string> {
  itemKey: TKey;
  selected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}

export interface SelectedItemListProps<TKey extends string = string> {
  title: ReactNode;
  description?: ReactNode;
  filter?: SelectedItemListFilterProps;
  itemKeys: readonly TKey[];
  selectedKeys: readonly TKey[];
  onToggleSelect: (key: TKey) => void;
  onRemove: (key: TKey) => void;
  renderItem: (props: SelectedItemListRenderProps<TKey>) => ReactNode;
  emptyMessage?: string;
  maxHeight?: number;
  toolbar?: ReactNode;
}

export default function SelectedItemList<TKey extends string>({
  title,
  description,
  filter,
  itemKeys,
  selectedKeys,
  onToggleSelect,
  onRemove,
  renderItem,
  emptyMessage = 'No items',
  maxHeight = 360,
  toolbar,
}: SelectedItemListProps<TKey>) {
  const selectedSet = new Set(selectedKeys);

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {title}
          </Text>
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
        {filter ? (
          <TextInput
            placeholder={filter.placeholder ?? 'Filter…'}
            value={filter.value}
            onChange={(e) => filter.onChange(e.currentTarget.value)}
            size="xs"
            maw={240}
            aria-label={filter['aria-label'] ?? 'Filter items'}
          />
        ) : null}
      </Group>

      <ScrollArea.Autosize mah={maxHeight} type="auto" offsetScrollbars>
        <Stack gap={6}>
          {itemKeys.length === 0 ? (
            <Text size="sm" c="dimmed" p="xs">
              {emptyMessage}
            </Text>
          ) : (
            itemKeys.map((itemKey) =>
              renderItem({
                itemKey,
                selected: selectedSet.has(itemKey),
                onToggleSelect: () => onToggleSelect(itemKey),
                onRemove: () => onRemove(itemKey),
              }),
            )
          )}
        </Stack>
      </ScrollArea.Autosize>

      {toolbar}
    </Stack>
  );
}
