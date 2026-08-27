import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PercentLevelSlider from './PercentLevelSlider.tsx';

describe('PercentLevelSlider', () => {
  it('omits the value suffix when the level is radio default', () => {
    render(
      <MantineProvider>
        <PercentLevelSlider label="Power" value={null} onChange={() => undefined} />
      </MantineProvider>,
    );

    expect(screen.getByText('Power')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('shows the value suffix when a percent is set', () => {
    render(
      <MantineProvider>
        <PercentLevelSlider label="Power" value={50} onChange={() => undefined} />
      </MantineProvider>,
    );

    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('omits the value suffix when showValue is false', () => {
    render(
      <MantineProvider>
        <PercentLevelSlider label="Power" value={50} showValue={false} onChange={() => undefined} />
      </MantineProvider>,
    );

    expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
  });
});
