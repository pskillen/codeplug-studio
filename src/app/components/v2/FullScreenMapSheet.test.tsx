import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import FullScreenMapSheet from './FullScreenMapSheet.tsx';
import MapThumbnail from './MapThumbnail.tsx';

function sheet(props: Partial<React.ComponentProps<typeof FullScreenMapSheet>> = {}) {
  return (
    <DesignSystemV2Provider>
      <FullScreenMapSheet
        open
        title="Pick centre"
        onClose={() => {}}
        confirmLabel="Use this point"
        onConfirm={() => {}}
        {...props}
      >
        <div data-testid="map" />
      </FullScreenMapSheet>
    </DesignSystemV2Provider>
  );
}

describe('FullScreenMapSheet', () => {
  it('renders nothing while closed', () => {
    render(sheet({ open: false }));
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  });

  it('confirms, and closes via the button and Escape', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(sheet({ onConfirm, onClose, hint: 'IO85uk' }));
    expect(screen.getByText('IO85uk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use this point' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('disables the confirm action until there is a point', () => {
    render(sheet({ confirmDisabled: true }));
    expect(screen.getByRole('button', { name: 'Use this point' })).toBeDisabled();
  });
});

describe('MapThumbnail', () => {
  it('opens on tap', () => {
    const onOpen = vi.fn();
    render(
      <DesignSystemV2Provider>
        <MapThumbnail label="Open map" onOpen={onOpen}>
          <div />
        </MapThumbnail>
      </DesignSystemV2Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open map' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
