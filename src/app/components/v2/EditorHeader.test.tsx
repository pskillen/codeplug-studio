import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import EditorHeader from './EditorHeader.tsx';

describe('EditorHeader', () => {
  it('renders title and subtitle', () => {
    render(
      <DesignSystemV2Provider>
        <EditorHeader
          crumb="Channels"
          title="New channel"
          subtitle="Set up the identity, frequency and mode for this channel."
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('heading', { name: 'New channel' })).toBeInTheDocument();
    expect(
      screen.getByText('Set up the identity, frequency and mode for this channel.'),
    ).toBeInTheDocument();
  });

  it('renders crumb as link when crumbTo is set', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <EditorHeader crumb="Channels" crumbTo="/library/channels" title="Edit" />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Channels/i })).toHaveAttribute(
      'href',
      '/library/channels',
    );
  });

  it('fires onCrumbClick for button crumb', async () => {
    const onCrumbClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <EditorHeader crumb="Channels" onCrumbClick={onCrumbClick} title="Edit" />
      </DesignSystemV2Provider>,
    );

    await screen.getByRole('button', { name: /Channels/i }).click();
    expect(onCrumbClick).toHaveBeenCalledOnce();
  });
});
