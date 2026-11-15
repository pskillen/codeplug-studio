import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BackupLabelFields, { backupLabelSummary } from './BackupLabelFields.tsx';

describe('BackupLabelFields', () => {
  it('commits on blur only when a value changed', () => {
    const onCommit = vi.fn();
    render(
      <MantineProvider>
        <BackupLabelFields value={{ label: 'Old' }} onCommit={onCommit} />
      </MantineProvider>,
    );
    const name = screen.getByLabelText('Radio name');
    fireEvent.blur(name);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: 'Radio 1' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(name);
    expect(onCommit).toHaveBeenCalledWith({ label: 'Old', radioName: 'Radio 1' });
  });

  it('summarises radio name and label', () => {
    expect(backupLabelSummary({ radioName: 'Radio 1', label: 'Before' })).toBe('Radio 1 · Before');
    expect(backupLabelSummary({ description: 'x' })).toBeNull();
  });
});
