import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { Rt95Calibration } from './Rt95Calibration.tsx';

describe('RT95 calibration', () => {
  it('shows the evidence limits and absent values without write controls', () => {
    render(
      <DesignSystemV2Provider>
        <Rt95Calibration />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    expect(screen.getByText(/MAIN V1.61/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not captured/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /write|restore/i })).not.toBeInTheDocument();
  });
});
