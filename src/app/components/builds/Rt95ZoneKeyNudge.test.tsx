import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '../v2/index.ts';
import Rt95ZoneKeyNudge from './Rt95ZoneKeyNudge.tsx';

function show(zones: number, zoneKeySet: boolean) {
  render(
    <DesignSystemV2Provider>
      <Rt95ZoneKeyNudge zones={zones} zoneKeySet={zoneKeySet} />
    </DesignSystemV2Provider>,
  );
}

describe('Rt95ZoneKeyNudge', () => {
  it('shows with zones and no zone key', () => {
    show(2, false);
    expect(screen.getByText(/No key opens the zone selector/)).toBeInTheDocument();
  });
  it('is hidden with no zones', () => {
    show(0, false);
    expect(screen.queryByTestId('rt95-zone-key-nudge')).not.toBeInTheDocument();
  });
  it('is hidden when the zone key is set', () => {
    show(2, true);
    expect(screen.queryByTestId('rt95-zone-key-nudge')).not.toBeInTheDocument();
  });
});
