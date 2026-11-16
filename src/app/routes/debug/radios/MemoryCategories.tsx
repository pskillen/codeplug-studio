import { Select, Stack } from '@mantine/core';
import { useState, type ReactNode } from 'react';

export interface MemoryCategory {
  value: string;
  label: string;
  /** Item count, shown in the option label when known. */
  count?: number;
  render: () => ReactNode;
}

function readRemembered(storageKey: string | undefined): string | null {
  if (!storageKey) return null;
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function remember(storageKey: string | undefined, value: string) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    /* storage unavailable: the choice lasts for this view only */
  }
}

/** A category dropdown and the one selected panel, for the debug Memory views. */
export function MemoryCategories({
  categories,
  storageKey,
}: {
  categories: MemoryCategory[];
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
      <div key={active.value}>{active.render()}</div>
    </Stack>
  );
}
