import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Confidence } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ConfidenceBadge from './ConfidenceBadge.tsx';

describe('ConfidenceBadge', () => {
  const cases: [Confidence, string][] = [
    ['traced', 'traced'],
    ['partially-traced', 'partly traced'],
    ['inferred', 'inferred'],
    ['unknown', 'unknown'],
    ['unused', 'unused (no reader)'],
  ];

  it.each(cases)('shows %s in full', (value, text) => {
    render(
      <DesignSystemV2Provider>
        <ConfidenceBadge value={value} kind="layout" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByTitle(`layout confidence: ${text}`)).toBeInTheDocument();
  });

  it('has a default tooltip without a kind', () => {
    render(
      <DesignSystemV2Provider>
        <ConfidenceBadge value="traced" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByTitle('Confidence: traced')).toBeInTheDocument();
  });
});
