import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import ModalShell from './ModalShell.tsx';

describe('ModalShell', () => {
  it('renders title and children when open', () => {
    render(
      <DesignSystemV2Provider>
        <ModalShell open onClose={() => undefined} title="Example modal">
          Body content
        </ModalShell>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Example modal')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ModalShell open onClose={onClose} title="Example modal">
          Body content
        </ModalShell>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides the close button when not dismissible', () => {
    render(
      <DesignSystemV2Provider>
        <ModalShell open onClose={() => undefined} title="Example modal" dismissible={false}>
          Body content
        </ModalShell>
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('inline renders panel markup without the dialog overlay', () => {
    render(
      <DesignSystemV2Provider>
        <ModalShell open onClose={() => undefined} title="Inline panel" inline>
          Inline content
        </ModalShell>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Inline content')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('inline renders nothing when closed', () => {
    render(
      <DesignSystemV2Provider>
        <ModalShell open={false} onClose={() => undefined} title="Inline panel" inline>
          Inline content
        </ModalShell>
      </DesignSystemV2Provider>,
    );

    expect(screen.queryByText('Inline content')).not.toBeInTheDocument();
  });
});
