import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryCategories } from './MemoryCategories.tsx';
import { chooseCategory } from './memoryCategoriesTestUtils.ts';

const categories = [
  { value: 'one', label: 'One', count: 3, render: () => <p>panel one</p> },
  { value: 'two', label: 'Two', render: () => <p>panel two</p> },
];
const show = (storageKey?: string, notDecoded?: string[]) =>
  render(
    <MantineProvider>
      <MemoryCategories categories={categories} storageKey={storageKey} notDecoded={notDecoded} />
    </MantineProvider>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('MemoryCategories', () => {
  it('renders the first category by default and only the selected panel', () => {
    show();
    expect(screen.getByText('panel one')).toBeInTheDocument();
    expect(screen.queryByText('panel two')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('One (3)');
  });

  it('switches category and shows counts in option labels', () => {
    show();
    chooseCategory('Two');
    expect(screen.getByText('panel two')).toBeInTheDocument();
    expect(screen.queryByText('panel one')).not.toBeInTheDocument();
  });

  it('remembers the last choice under the storage key', () => {
    show('debug-memory-category:test');
    chooseCategory('Two');
    cleanup();
    show('debug-memory-category:test');
    expect(screen.getByText('panel two')).toBeInTheDocument();
  });

  it('works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    show('debug-memory-category:test');
    expect(screen.getByText('panel one')).toBeInTheDocument();
    chooseCategory('Two');
    expect(screen.getByText('panel two')).toBeInTheDocument();
  });

  it('falls back to the first category when the remembered one is gone', () => {
    window.localStorage.setItem('mm9pdy-codeplug-studio.debug-memory-category:test', 'missing');
    show('debug-memory-category:test');
    expect(screen.getByText('panel one')).toBeInTheDocument();
  });

  it('names undecoded categories in one line, and nothing when the list is empty', () => {
    show(undefined, ['scan lists', 'contacts']);
    expect(
      screen.getByText('Not decoded for this radio yet: scan lists, contacts.'),
    ).toBeInTheDocument();
    cleanup();
    show(undefined, []);
    expect(screen.queryByText(/Not decoded for this radio yet/)).not.toBeInTheDocument();
  });
});
