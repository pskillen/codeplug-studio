import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import EvidenceNotice from './EvidenceNotice.tsx';

const wrap = (ui: React.ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

describe('EvidenceNotice', () => {
  it('shows short notices in full with no More button', () => {
    wrap(
      <EvidenceNotice notice={{ title: 'Not validated', lines: ['a', 'b'], tone: 'caution' }} />,
    );
    expect(screen.getByText('Not validated')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('note')).toHaveAttribute('data-tone', 'caution');
  });

  it('folds lines after the second behind More', () => {
    wrap(<EvidenceNotice notice={{ title: 'T', lines: ['a', 'b', 'c', 'd'], tone: 'info' }} />);
    expect(screen.queryByText('c')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Less' }));
    expect(screen.queryByText('c')).toBeNull();
  });
});
