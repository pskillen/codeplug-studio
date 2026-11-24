import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirmwareSwitch } from './FirmwareSwitch.tsx';

describe('FirmwareSwitch', () => {
  it('renders options in order and reports changes', () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <FirmwareSwitch
          value="stock"
          onChange={onChange}
          options={[
            { firmware: 'stock', capture: () => Promise.resolve({} as never) },
            { firmware: 'radiofoundry' },
          ]}
        />
      </MantineProvider>,
    );
    const control = screen.getByLabelText('Firmware');
    expect(control).toHaveTextContent('Stock / MM9PDY');
    expect(control).toHaveTextContent('RadioFoundry');
    fireEvent.click(screen.getByText('RadioFoundry'));
    expect(onChange).toHaveBeenCalledWith('radiofoundry');
  });
});
