import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import Panel from './Panel.tsx';

describe('Panel', () => {
  it('renders title and children', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="Identity" id="Identity">
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('heading', { name: 'Identity' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(document.getElementById('Identity')).toBeTruthy();
  });

  it('renders optional sub copy', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="Modes" sub="Turn modes on or off.">
          Content
        </Panel>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Turn modes on or off.')).toBeInTheDocument();
  });

  it('shows the body by default when collapsible, unless defaultCollapsed is set', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="Orbital elements" collapsible>
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Orbital elements' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('starts collapsed when defaultCollapsed is set, and toggles on click', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="Orbital elements" collapsible defaultCollapsed>
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByText('Body')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Orbital elements' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });

  it('shows a header badge while collapsed', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="RF" collapsible defaultCollapsed badge="2 changes">
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('2 changes')).toBeInTheDocument();
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });
});
