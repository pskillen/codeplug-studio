import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import CountTile from './CountTile.tsx';

describe('CountTile', () => {
  it('renders value and label', () => {
    render(
      <DesignSystemV2Provider>
        <CountTile value={42} label="Channels" />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Channels')).toBeInTheDocument();
  });

  it('renders optional total denominator', () => {
    render(
      <DesignSystemV2Provider>
        <CountTile value={18} total={24} label="Included" />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('/24')).toBeInTheDocument();
  });
});
