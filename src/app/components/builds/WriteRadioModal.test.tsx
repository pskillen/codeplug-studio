import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { DigitalContactsWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import WriteRadioModal from './WriteRadioModal.tsx';

function renderModal(overrides: Partial<ComponentProps<typeof WriteRadioModal>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    buildId: 'build-1',
    serialOk: true,
    busy: false,
    writeHidden: false,
    supportsDigitalContacts: true,
    supportsKeps: true,
    contactSource: 'none' as DigitalContactsWriteSource,
    onContactSourceChange: vi.fn(),
    kepsSelected: false,
    onKepsSelectedChange: vi.fn(),
    onWriteCodeplug: vi.fn(),
    onWriteContacts: vi.fn(),
    onWriteKeps: vi.fn(),
    ...overrides,
  };
  return {
    ...render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <WriteRadioModal {...props} />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    ),
    props,
  };
}

describe('WriteRadioModal (#1121)', () => {
  it('shows Write codeplug first and defaults extras off', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Write codeplug' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Write digital contacts' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Write satellite keps' })).toBeDisabled();
    expect(screen.queryByText(/digital ID list/i)).not.toBeInTheDocument();
  });

  it('enables Write this for digital contacts after a source is chosen', () => {
    const { props } = renderModal({ contactSource: 'library' });
    expect(screen.getByRole('button', { name: 'Write digital contacts' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Write digital contacts' }));
    expect(props.onWriteContacts).toHaveBeenCalled();
  });

  it('hides keps extra when the radio has no adapter', () => {
    renderModal({ supportsKeps: false });
    expect(screen.queryByRole('checkbox', { name: 'Satellite keps' })).not.toBeInTheDocument();
  });

  it('hides digital contacts extra on analog radios', () => {
    renderModal({ supportsDigitalContacts: false, supportsKeps: false });
    expect(screen.getByRole('button', { name: 'Write codeplug' })).toBeInTheDocument();
    expect(screen.queryByText('Digital contacts')).not.toBeInTheDocument();
  });

  it('links to the Satellite keps tab for preview', () => {
    renderModal();
    expect(screen.getByRole('link', { name: 'Preview on the Satellite keps tab' })).toHaveAttribute(
      'href',
      '/builds/build-1/satellite-keps',
    );
  });
});
