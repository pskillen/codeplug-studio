import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import MapSheet from './MapSheet.tsx';

describe('MapSheet', () => {
  it('renders header and body and reports the snap', () => {
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="half" onSnapChange={() => {}} header={<b>12 repeaters</b>}>
            <p>row</p>
          </MapSheet>
        </div>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('12 repeaters')).toBeInTheDocument();
    expect(screen.getByText('row')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Results' })).toHaveAttribute('data-snap', 'half');
  });

  it('steps with the keyboard', () => {
    const onSnapChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="peek" onSnapChange={onSnapChange} />
        </div>
      </DesignSystemV2Provider>,
    );
    const handle = screen.getByRole('slider');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onSnapChange).toHaveBeenLastCalledWith('peek');
  });

  it('cycles when the handle is tapped without dragging', () => {
    const onSnapChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="half" onSnapChange={onSnapChange} />
        </div>
      </DesignSystemV2Provider>,
    );
    const handle = screen.getByRole('slider');
    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 400, pointerId: 1 });
    expect(onSnapChange).toHaveBeenCalledWith('full');
  });

  it('toggleOnTap: a tap goes peek <-> half instead of cycling', () => {
    const onSnapChange = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="full" onSnapChange={onSnapChange} toggleOnTap />
        </div>
      </DesignSystemV2Provider>,
    );
    const tap = () => {
      const handle = screen.getByRole('slider');
      fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 });
      fireEvent.pointerUp(handle, { clientY: 400, pointerId: 1 });
    };
    tap();
    expect(onSnapChange).toHaveBeenLastCalledWith('peek');
    rerender(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="peek" onSnapChange={onSnapChange} toggleOnTap />
        </div>
      </DesignSystemV2Provider>,
    );
    tap();
    expect(onSnapChange).toHaveBeenLastCalledWith('half');
  });

  it('backdrop: shown above peek, and tapping it collapses to peek', () => {
    const onSnapChange = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="peek" onSnapChange={onSnapChange} backdrop label="Controls" />
        </div>
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Close controls' })).not.toBeInTheDocument();
    rerender(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="half" onSnapChange={onSnapChange} backdrop label="Controls" />
        </div>
      </DesignSystemV2Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close controls' }));
    expect(onSnapChange).toHaveBeenCalledWith('peek');
  });

  it('has no backdrop unless asked', () => {
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="half" onSnapChange={() => {}} />
        </div>
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();
  });
});
