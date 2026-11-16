import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import CalibrationReadPicker from './CalibrationReadPicker.tsx';

const entries = [
  { id: 'a', label: 'Read A' },
  { id: 'b', label: 'Read B', time: new Date(2026, 0, 1, 10, 30, 0) },
  { id: 'c', label: 'Read C' },
];

function setup(props: { readId: string; overlayId: string | null }) {
  const onRead = vi.fn();
  const onOverlay = vi.fn();
  render(
    <DesignSystemV2Provider>
      <CalibrationReadPicker entries={entries} {...props} onRead={onRead} onOverlay={onOverlay} />
    </DesignSystemV2Provider>,
  );
  return { onRead, onOverlay };
}

describe('CalibrationReadPicker', () => {
  it('has Read and Overlay (optional) selects showing the picks', () => {
    setup({ readId: 'a', overlayId: null });
    expect(screen.getByRole('combobox', { name: 'Read' })).toHaveValue('Read A');
    expect(screen.getByRole('combobox', { name: 'Overlay (optional)' })).toHaveValue('None');
  });

  it('overlay list excludes the read and starts with None', () => {
    setup({ readId: 'a', overlayId: null });
    fireEvent.click(screen.getByRole('combobox', { name: 'Overlay (optional)' }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['None', expect.stringContaining('Read B'), 'Read C']);
  });

  it('reports picks and a None overlay as null', () => {
    const { onRead, onOverlay } = setup({ readId: 'a', overlayId: 'b' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Overlay (optional)' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onOverlay).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('combobox', { name: 'Read' }));
    fireEvent.click(screen.getByRole('option', { name: 'Read C' }));
    expect(onRead).toHaveBeenCalledWith('c');
  });

  it('shows an overlay equal to the read as None', () => {
    setup({ readId: 'a', overlayId: 'a' });
    expect(screen.getByRole('combobox', { name: 'Overlay (optional)' })).toHaveValue('None');
  });
});
