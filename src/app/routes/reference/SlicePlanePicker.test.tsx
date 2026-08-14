import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { pathMetricsBetween } from '@core/domain/geoDistance.ts';
import { locatorToCoords } from '@core/domain/maidenhead.ts';
import { GeocodeError, geocodeQuery } from '@integrations/geocode/index.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import SlicePlanePicker, {
  DEFAULT_RANGE_M,
  formatSlicePlaneReadout,
  resolveSlicePlane,
} from './SlicePlanePicker.tsx';

vi.mock('@integrations/geocode/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@integrations/geocode/index.ts')>();
  return { ...actual, geocodeQuery: vi.fn() };
});

const LONDON = locatorToCoords('IO91WM')!;

function renderPicker(props?: Partial<ComponentProps<typeof SlicePlanePicker>>) {
  const onChange = props?.onChange ?? vi.fn();
  const view = render(
    <MantineProvider>
      <DesignSystemV2Provider>
        <SlicePlanePicker
          transmitterLocation={LONDON}
          defaultBearingDeg={90}
          onChange={onChange}
          {...props}
        />
      </DesignSystemV2Provider>
    </MantineProvider>,
  );
  return { onChange, ...view };
}

describe('SlicePlanePicker', () => {
  it('defaults bearing mode to the antenna heading and 4,000 km range', () => {
    const { onChange } = renderPicker({ defaultBearingDeg: 96 });

    expect(screen.getByTestId('slice-plane-readout')).toHaveTextContent(
      formatSlicePlaneReadout({ bearingDeg: 96, distanceM: DEFAULT_RANGE_M }),
    );
    expect(onChange).toHaveBeenCalledWith({ bearingDeg: 96, distanceM: DEFAULT_RANGE_M });
  });

  it('tracks antenna heading until the operator moves the bearing slider', () => {
    const onChange = vi.fn();
    const { rerender } = renderPicker({ onChange, defaultBearingDeg: 90 });

    rerender(
      <MantineProvider>
        <DesignSystemV2Provider>
          <SlicePlanePicker
            transmitterLocation={LONDON}
            defaultBearingDeg={180}
            onChange={onChange}
          />
        </DesignSystemV2Provider>
      </MantineProvider>,
    );

    expect(onChange).toHaveBeenCalledWith({ bearingDeg: 180, distanceM: DEFAULT_RANGE_M });

    const bearingThumb = screen.getByRole('slider', { name: 'Slice-plane bearing' });
    fireEvent.keyDown(bearingThumb, { key: 'ArrowLeft' });

    const afterTouch = onChange.mock.calls.at(-1)?.[0] as { bearingDeg: number };
    expect(afterTouch.bearingDeg).toBe(179);

    rerender(
      <MantineProvider>
        <DesignSystemV2Provider>
          <SlicePlanePicker
            transmitterLocation={LONDON}
            defaultBearingDeg={10}
            onChange={onChange}
          />
        </DesignSystemV2Provider>
      </MantineProvider>,
    );

    const last = onChange.mock.calls.at(-1)?.[0] as { bearingDeg: number };
    expect(last.bearingDeg).toBe(179);
  });

  it('resolveSlicePlane matches pathMetricsBetween for a known locator pair', () => {
    const amsterdam = locatorToCoords('JO22')!;
    const expected = pathMetricsBetween(LONDON, amsterdam);
    expect(
      resolveSlicePlane({
        mode: 'locator',
        manualBearingDeg: 0,
        manualRangeM: DEFAULT_RANGE_M,
        transmitterLocation: LONDON,
        toCoords: amsterdam,
      }),
    ).toEqual({ bearingDeg: expected.bearingAB, distanceM: expected.distanceM });
  });

  it('derives bearing and distance from a known locator pair', () => {
    const { onChange } = renderPicker();
    const amsterdam = locatorToCoords('JO22')!;
    const expected = pathMetricsBetween(LONDON, amsterdam);

    fireEvent.click(screen.getByRole('button', { name: 'Locator' }));
    fireEvent.change(screen.getByLabelText('To locator'), { target: { value: 'JO22' } });

    expect(onChange).toHaveBeenCalledWith({
      bearingDeg: expected.bearingAB,
      distanceM: expected.distanceM,
    });
    expect(screen.getByTestId('slice-plane-readout')).toHaveTextContent(
      formatSlicePlaneReadout({
        bearingDeg: expected.bearingAB,
        distanceM: expected.distanceM,
      }),
    );
  });

  it('derives bearing and distance from a geocoded address', async () => {
    const destination = { lat: 52.37, lon: 4.9 };
    vi.mocked(geocodeQuery).mockResolvedValue({
      lat: destination.lat,
      lon: destination.lon,
      label: 'Amsterdam',
    });
    const expected = pathMetricsBetween(LONDON, destination);
    const { onChange } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Address' }));
    fireEvent.change(screen.getByLabelText('Address or postcode'), {
      target: { value: 'Amsterdam' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        bearingDeg: expected.bearingAB,
        distanceM: expected.distanceM,
      });
    });
    expect(geocodeQuery).toHaveBeenCalledWith('Amsterdam', {
      mapboxToken: '',
      provider: 'photon',
    });
  });

  it('surfaces geocode errors', async () => {
    vi.mocked(geocodeQuery).mockRejectedValue(new GeocodeError('Look-up failed'));
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Address' }));
    fireEvent.change(screen.getByLabelText('Address or postcode'), {
      target: { value: 'nowhere' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Look-up failed');
  });
});
