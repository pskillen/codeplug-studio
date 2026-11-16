import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import UnusedRanges, { unusedCountLine } from './UnusedRanges.tsx';

const ranges = [
  { start: '0x0100', end: '0x04FF', bytes: 1024, why: 'no reader' },
  { start: '0x0600', end: '0x06B2', bytes: 179, why: 'no reader' },
];

describe('UnusedRanges', () => {
  it('words the count line', () => {
    expect(unusedCountLine(ranges)).toBe('1,203 bytes in 2 ranges are unused (no reader)');
    expect(unusedCountLine([ranges[1]])).toBe('179 bytes in 1 range is unused (no reader)');
  });

  it('is folded by default and lists ranges on open', () => {
    render(
      <DesignSystemV2Provider>
        <UnusedRanges ranges={ranges} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText(/1,203 bytes in 2 ranges/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Never read/ }));
    expect(screen.getByText('0x0100')).toBeInTheDocument();
  });

  it('renders nothing when empty', () => {
    const { container } = render(<UnusedRanges ranges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
