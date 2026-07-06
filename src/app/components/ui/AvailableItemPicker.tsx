import { Button, Group, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import type { ReactNode } from 'react';

export interface AvailableItemPickerFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}

export interface AvailableItemPickerRenderProps<TKey extends string> {
  itemKey: TKey;
  checked: boolean;
  onToggle: () => void;
}

export interface AvailableItemPickerSection<TKey extends string = string> {
  id: string;
  title: string;
  itemKeys: readonly TKey[];
  selectedKeys: readonly TKey[];
  onToggleSelect: (key: TKey) => void;
  renderItem: (props: AvailableItemPickerRenderProps<TKey>) => ReactNode;
  emptyMessage?: string;
}

export interface AvailableItemPickerProps<TKey extends string = string> {
  title: ReactNode;
  filter?: AvailableItemPickerFilterProps;
  sections: readonly AvailableItemPickerSection<TKey>[];
  maxHeight?: number;
  addLabel?: string;
  onAddSelected?: () => void;
  addDisabled?: boolean;
  footer?: ReactNode;
}

export default function AvailableItemPicker<TKey extends string>({
  title,
  filter,
  sections,
  maxHeight = 280,
  addLabel = 'Add selected',
  onAddSelected,
  addDisabled,
  footer,
}: AvailableItemPickerProps<TKey>) {
  const showFooter = onAddSelected != null || footer != null;

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {filter ? (
          <TextInput
            placeholder={filter.placeholder ?? 'Filter…'}
            value={filter.value}
            onChange={(e) => filter.onChange(e.currentTarget.value)}
            size="xs"
            maw={240}
            aria-label={filter['aria-label'] ?? 'Filter available items'}
          />
        ) : null}
      </Group>

      <ScrollArea.Autosize mah={maxHeight} type="auto" offsetScrollbars>
        <Stack gap="md">
          {sections.map((section) => {
            const selectedSet = new Set(section.selectedKeys);
            return (
              <Stack key={section.id} gap={4}>
                <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                  {section.title}
                </Text>
                {section.itemKeys.length === 0 ? (
                  <Text size="sm" c="dimmed" p="xs">
                    {section.emptyMessage ?? 'Nothing available'}
                  </Text>
                ) : (
                  section.itemKeys.map((itemKey) =>
                    section.renderItem({
                      itemKey,
                      checked: selectedSet.has(itemKey),
                      onToggle: () => section.onToggleSelect(itemKey),
                    }),
                  )
                )}
              </Stack>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>

      {showFooter ? (
        <Group gap="sm">
          {onAddSelected ? (
            <Button type="button" variant="light" onClick={onAddSelected} disabled={addDisabled}>
              {addLabel}
            </Button>
          ) : null}
          {footer}
        </Group>
      ) : null}
    </Stack>
  );
}
