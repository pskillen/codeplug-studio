import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { pathMetricsBetween } from '@core/domain/geoDistance.ts';
import { locatorToCoords } from '@core/domain/maidenhead.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import SlicePlanePicker, {
  DEFAULT_RANGE_M,
  formatSlicePlaneReadout,
  resolveSlicePlane,
} from './SlicePlanePicker.tsx';

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
});
