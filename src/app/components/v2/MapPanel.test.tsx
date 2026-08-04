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
});
