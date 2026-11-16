import { Select, Stack, Text } from '@mantine/core';
import { useState, type ReactNode } from 'react';

export interface MemoryCategory {
  value: string;
  label: string;
  /** Item count, shown in the option label when known. */
  count?: number;
  render: () => ReactNode;
}

/** Same app prefix as the list preferences, so the choice lives beside them. */
const STORAGE_PREFIX = 'mm9pdy-codeplug-studio.';

function readRemembered(storageKey: string | undefined): string | null {
  if (!storageKey) return null;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + storageKey);
  } catch {
    return null;
  }
}

function remember(storageKey: string | undefined, value: string) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, value);
  } catch {
    /* storage unavailable: the choice lasts for this view only */
  }
}

/** A category dropdown and the one selected panel, for the debug Memory views. */
export function MemoryCategories({
  categories,
  storageKey,
  notDecoded,
}: {
  categories: MemoryCategory[];
  /** Category names this radio does not decode yet, named in one line under the dropdown. */
  notDecoded?: readonly string[];
  /** Where to remember the last choice; omit to remember nothing. */
  storageKey?: string;
}) {
  const [chosen, setChosen] = useState<string | null>(() => readRemembered(storageKey));
  const active = categories.find((c) => c.value === chosen) ?? categories[0];
  if (!active) return null;
  return (
    <Stack gap="md">
      <Select
        label="Category"
        data={categories.map((c) => ({
          value: c.value,
          label: c.count === undefined ? c.label : `${c.label} (${c.count})`,
        }))}
        value={active.value}
        onChange={(value) => {
          if (!value) return;
          setChosen(value);
          remember(storageKey, value);
        }}
        allowDeselect={false}
      />
      {notDecoded && notDecoded.length > 0 ? (
        <Text size="sm" c="dimmed">
          Not decoded for this radio yet: {notDecoded.join(', ')}.
        </Text>
      ) : null}
      <div key={active.value}>{active.render()}</div>
    </Stack>
  );
}
