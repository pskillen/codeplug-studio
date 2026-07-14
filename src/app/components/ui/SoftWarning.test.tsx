import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import SoftWarning from './SoftWarning.tsx';

describe('SoftWarning', () => {
  it('renders title and body', () => {
    render(
      <MantineProvider defaultColorScheme="dark">
        <SoftWarning title="Browser-only backup">Export YAML to back up.</SoftWarning>
      </MantineProvider>,
    );

    expect(screen.getByText('Browser-only backup')).toBeInTheDocument();
    expect(screen.getByText('Export YAML to back up.')).toBeInTheDocument();
  });

  it('calls onDismiss when close is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <MantineProvider defaultColorScheme="dark">
        <SoftWarning onDismiss={onDismiss}>Notice</SoftWarning>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('sets danger tone data attribute', () => {
    const { container } = render(
      <MantineProvider defaultColorScheme="dark">
        <SoftWarning tone="danger">Session expired</SoftWarning>
      </MantineProvider>,
    );

    expect(container.querySelector('[data-tone="danger"]')).toBeTruthy();
  });
});
