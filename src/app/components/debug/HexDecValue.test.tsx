import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HexDecValue from './HexDecValue.tsx';

describe('HexDecValue', () => {
  it('prints hex and decimal by default', () => {
    render(<HexDecValue value={26} />);
    expect(screen.getByText('0x1A (26)')).toBeInTheDocument();
  });

  it('pads two-byte values', () => {
    render(<HexDecValue value={2000} width={2} />);
    expect(screen.getByText('0x07D0 (2000)')).toBeInTheDocument();
  });

  it('prints plain decimal with a unit, or hex alone, when asked', () => {
    const { rerender } = render(<HexDecValue value={145} format="decimal" unit="MHz" />);
    expect(screen.getByText('145 MHz')).toBeInTheDocument();
    rerender(<HexDecValue value={0x3cc0} width={2} format="hex" />);
    expect(screen.getByText('0x3CC0')).toBeInTheDocument();
  });

  it('masks sensitive values and words missing ones', () => {
    const { rerender } = render(<HexDecValue value={26} masked />);
    expect(screen.getByText('••')).toBeInTheDocument();
    expect(screen.queryByText(/0x1A/)).toBeNull();
    rerender(<HexDecValue value={undefined} />);
    expect(screen.getByText('Not captured')).toBeInTheDocument();
  });
});
