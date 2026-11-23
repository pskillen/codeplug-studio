import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ModeSummaryChip from './ModeSummaryChip.tsx';
import type { ChannelModeSummary } from '../../lib/channelModeSummary.ts';

const base: ChannelModeSummary = {
  mode: 'dmr',
  label: 'DMR',
  detail: 'CC1 TS2 TG2351',
  isMain: false,
};

function renderChip(summary: ChannelModeSummary) {
  return render(
    <DesignSystemV2Provider>
      <ModeSummaryChip summary={summary} />
    </DesignSystemV2Provider>,
  );
}

describe('ModeSummaryChip', () => {
  it('shows label then detail', () => {
    renderChip(base);
    expect(screen.getByText('DMR')).toBeInTheDocument();
    expect(screen.getByText('CC1 TS2 TG2351')).toBeInTheDocument();
  });

  it('sets title to the full summary', () => {
    renderChip(base);
    expect(screen.getByTitle('DMR CC1 TS2 TG2351')).toBeInTheDocument();
  });

  it('includes main mode in the title when isMain', () => {
    renderChip({ ...base, isMain: true });
    expect(screen.getByTitle('DMR CC1 TS2 TG2351 · main mode')).toBeInTheDocument();
  });

  it('renders label only when detail is empty', () => {
    renderChip({ ...base, detail: '' });
    expect(screen.getByText('DMR')).toBeInTheDocument();
    expect(screen.queryByText('CC1 TS2 TG2351')).not.toBeInTheDocument();
  });
});
