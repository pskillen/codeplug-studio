import { render, screen } from '@testing-library/react';
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
});
