import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import { Button, Pill } from './index.ts';
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

  it('renders header actions beside the title without wrapping the collapse toggle', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <Panel
          title="DMR"
          collapsible
          defaultCollapsed
          actions={
            <Button type="button" variant="ghost" size="sm">
              Make main
            </Button>
          }
        >
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );

    const section = container.querySelector('section');
    expect(section?.firstElementChild?.tagName).toBe('DIV');
    fireEvent.click(screen.getByRole('button', { name: 'Make main' }));
    const toggle = screen.getByRole('button', { name: 'DMR' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('leaves the first child as H2 when actions is unset', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <Panel title="Identity">
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );
    expect(container.querySelector('section')?.firstElementChild?.tagName).toBe('H2');
  });

  it('shows actions with a collapsible panel and a pill action', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="FM" collapsible actions={<Pill tone="accent">Main mode</Pill>}>
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Main mode')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('shows the one-line summary only while folded', () => {
    render(
      <DesignSystemV2Provider>
        <Panel title="Centre point" collapsible defaultCollapsed summary="IO85uk · 16 mi">
          <span>Body</span>
        </Panel>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('IO85uk · 16 mi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Centre point' }));
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.queryByText('IO85uk · 16 mi')).not.toBeInTheDocument();
  });
});
