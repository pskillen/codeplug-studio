import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import DebugSection from './DebugSection.tsx';

const wrap = (ui: React.ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

describe('DebugSection', () => {
  it('renders title, description, meta and body', () => {
    wrap(
      <DebugSection id="s1" title="Power" description="Drive per level." meta={<code>0x10</code>}>
        <span>Body</span>
      </DebugSection>,
    );
    expect(screen.getByRole('heading', { name: 'Power' })).toBeInTheDocument();
    expect(screen.getByText('Drive per level.')).toBeInTheDocument();
    expect(screen.getByText('0x10')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(document.getElementById('s1')).toBeTruthy();
  });

  it('collapses and expands, honouring defaultCollapsed', () => {
    wrap(
      <DebugSection title="Raw" collapsible defaultCollapsed>
        <span>Inside</span>
      </DebugSection>,
    );
    const toggle = screen.getByRole('button', { name: 'Raw' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Inside')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('is not a toggle when not collapsible', () => {
    wrap(<DebugSection title="Plain">x</DebugSection>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is an h3 by default and takes a heading level', () => {
    const { rerender } = wrap(<DebugSection title="Power" />);
    expect(screen.getByRole('heading', { name: 'Power', level: 3 })).toBeInTheDocument();
    rerender(
      <DesignSystemV2Provider>
        <DebugSection title="Power" headingLevel={2} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Power', level: 2 })).toBeInTheDocument();
  });
});
