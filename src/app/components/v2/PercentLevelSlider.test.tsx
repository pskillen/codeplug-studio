import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PercentLevelSlider from './PercentLevelSlider.tsx';

function PowerSlider({ initialValue }: { initialValue: number | null }) {
  const [value, setValue] = useState(initialValue);
  return (
    <MantineProvider>
      <PercentLevelSlider
        label="Power"
        value={value}
        onChange={setValue}
        min={1}
        step={1}
        extraEndpoint={{ value: 101, label: 'Above High' }}
        previewValues={[0, 101]}
      />
    </MantineProvider>
  );
}

describe('PercentLevelSlider', () => {
  it('moves between 100 and the named endpoint with the arrow keys', () => {
    render(<PowerSlider initialValue={99} />);
    const slider = screen.getByRole('slider', { name: 'Power' });

    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '101');
    expect(screen.getByText('100')).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '101');
    expect(slider).toHaveAttribute('aria-valuetext', 'Above High');
    expect(screen.getByText('— Above High')).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('draws the Above High zone after 100 and fills it when chosen', () => {
    const { container } = render(<PowerSlider initialValue={100} />);
    const zone = container.querySelector('[data-extra-zone]');
    expect(zone).not.toBeNull();
    expect(zone).not.toHaveAttribute('data-active');
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Power' }), { key: 'End' });
    expect(zone).toHaveAttribute('data-active');
    expect(screen.getByRole('slider', { name: 'Power' })).toHaveAttribute('aria-valuenow', '101');
  });

  it('leaves the zone with one step left, not a step within it', () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <PercentLevelSlider
          label="Power"
          value={101}
          onChange={onChange}
          min={1}
          step={1}
          extraEndpoint={{ value: 101, label: 'Above High' }}
        />
      </MantineProvider>,
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Power' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('has no zone without an extra endpoint', () => {
    const { container } = render(
      <MantineProvider>
        <PercentLevelSlider label="Squelch" value={50} onChange={() => undefined} />
      </MantineProvider>,
    );
    expect(container.querySelector('[data-extra-zone]')).toBeNull();
  });

  it('disables the power slider on radio default and re-enables at 50', () => {
    render(<PowerSlider initialValue={101} />);
    const slider = screen.getByRole('slider', { name: 'Power' });
    const radioDefault = screen.getByRole('checkbox', { name: 'Radio default' });

    fireEvent.click(radioDefault);
    expect(slider).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(radioDefault);
    expect(slider).toHaveAttribute('aria-disabled', 'false');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('places an Above High preview dot at the endpoint and clamps zero to the start', () => {
    const { container } = render(<PowerSlider initialValue={null} />);
    const dots = container.querySelectorAll('[data-preview-dots] span');
    expect(dots[0]).toHaveStyle({ left: '0%' });
    expect(dots[1]).toHaveStyle({ left: '100%' });
  });

  it('keeps generic squelch on the zero-to-100 scale with five-point snapping', () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <PercentLevelSlider label="Squelch" value={47} onChange={onChange} />
      </MantineProvider>,
    );
    const slider = screen.getByRole('slider', { name: 'Squelch' });
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '45');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(50);
  });

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

  it('parks the primary thumb at min when the level is radio default', () => {
    render(
      <MantineProvider>
        <PercentLevelSlider label="Power" value={null} onChange={() => undefined} />
      </MantineProvider>,
    );

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
  });

  it('draws a preview mark for each bulk value, with radio default at 50%', () => {
    const { container } = render(
      <MantineProvider>
        <PercentLevelSlider
          label="Power"
          value={null}
          onChange={() => undefined}
          previewValues={[25, null, 75]}
        />
      </MantineProvider>,
    );

    expect(container.querySelectorAll('[data-preview-dots] span')).toHaveLength(3);
  });
});
