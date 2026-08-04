import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import MapPanel from './MapPanel.tsx';

describe('MapPanel', () => {
  it('renders title, hatch caption, and legend', () => {
    render(
      <DesignSystemV2Provider>
        <MapPanel title="Nearby" legend={<span>UHF</span>} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Nearby')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Map placeholder' })).toBeInTheDocument();
    expect(screen.getByText('[ map ]')).toBeInTheDocument();
    expect(screen.getByText('UHF')).toBeInTheDocument();
  });

  it('fires settings click', () => {
    const onSettingsClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <MapPanel title="Map" onSettingsClick={onSettingsClick} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Map settings' }));
    expect(onSettingsClick).toHaveBeenCalledOnce();
  });

  it('renders children instead of hatch placeholder', () => {
    render(
      <DesignSystemV2Provider>
        <MapPanel title="Live map" height={300}>
          <div data-testid="live-map">Map content</div>
        </MapPanel>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByTestId('live-map')).toBeInTheDocument();
    expect(screen.queryByText('[ map ]')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Map placeholder' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Map')).toBeInTheDocument();
  });
});
