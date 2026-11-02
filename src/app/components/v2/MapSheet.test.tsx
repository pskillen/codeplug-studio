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

  it('drags from the header as well as the handle', () => {
    const onSnapChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet snap="half" onSnapChange={onSnapChange} header={<span>3 repeaters</span>} />
        </div>
      </DesignSystemV2Provider>,
    );
    const header = screen.getByText('3 repeaters');
    fireEvent.pointerDown(header, { clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(header, { clientY: 900, pointerId: 1 });
    fireEvent.pointerUp(header, { clientY: 900, pointerId: 1 });
    expect(onSnapChange).toHaveBeenCalledWith('peek');
  });

  it('a tap on the header text or a header button does not change the snap', () => {
    const onSnapChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet
            snap="peek"
            onSnapChange={onSnapChange}
            header={
              <>
                <span>3 repeaters</span>
                <button type="button">New</button>
              </>
            }
          />
        </div>
      </DesignSystemV2Provider>,
    );
    for (const el of [
      screen.getByText('3 repeaters'),
      screen.getByRole('button', { name: 'New' }),
    ]) {
      fireEvent.pointerDown(el, { clientY: 400, pointerId: 1 });
      fireEvent.pointerUp(el, { clientY: 400, pointerId: 1 });
    }
    expect(onSnapChange).not.toHaveBeenCalled();
  });

  it('a drag that starts on a header button moves the sheet and does not click it', () => {
    const onSnapChange = vi.fn();
    const onClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <div style={{ position: 'relative' }}>
          <MapSheet
            snap="peek"
            onSnapChange={onSnapChange}
            header={
              <button type="button" onClick={onClick}>
                128 channels
              </button>
            }
          />
        </div>
      </DesignSystemV2Provider>,
    );
    const button = screen.getByRole('button', { name: '128 channels' });
    fireEvent.pointerDown(button, { clientY: 800, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 200, pointerId: 1 });
    fireEvent.click(button);
    expect(onSnapChange).toHaveBeenCalledWith('full');
    expect(onClick).not.toHaveBeenCalled();
  });
});
