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
    expect(screen.getByRole('button', { name: 'Write contacts only' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Write keps only' })).toBeDisabled();
    expect(screen.queryByText(/digital ID list/i)).not.toBeInTheDocument();
  });

  it('explains OpenGD77 User Database vs the 1024 contact bank', () => {
    renderModal({ sharedContactBankNote: true, supportsKeps: false });
    expect(screen.getByText(/firmware User Database/i)).toBeInTheDocument();
    expect(screen.getByText(/does not fill the 1024 contact bank/i)).toBeInTheDocument();
  });

  it('explains DM-32 shared address book vs operator radio IDs', () => {
    renderModal({ sharedAddressBookNote: true, supportsKeps: false });
    expect(screen.getByText(/share one address book/i)).toBeInTheDocument();
    expect(screen.getByText(/does not rewrite operator radio IDs/i)).toBeInTheDocument();
  });

  it('enables Write contacts only after a source is chosen', () => {
    const { props } = renderModal({ contactSource: 'library' });
    expect(screen.getByRole('button', { name: 'Write contacts only' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Write contacts only' }));
    expect(props.onWriteContacts).toHaveBeenCalled();
  });

  it('hides keps extra when the radio has no adapter', () => {
    renderModal({ supportsKeps: false });
    expect(screen.queryByRole('checkbox', { name: 'Satellite keps' })).not.toBeInTheDocument();
    expect(screen.queryByText(/satellite keps/i)).not.toBeInTheDocument();
    expect(screen.getByText(/digital contacts follow/i)).toBeInTheDocument();
  });

  it('hides digital contacts extra on analog radios', () => {
    renderModal({ supportsDigitalContacts: false, supportsKeps: false });
    expect(screen.getByRole('button', { name: 'Write codeplug' })).toBeInTheDocument();
    expect(screen.queryByText('Digital contacts')).not.toBeInTheDocument();
    expect(screen.queryByText(/digital contacts follow/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/satellite keps/i)).not.toBeInTheDocument();
  });

  it('links to the Satellite keps tab for preview', () => {
    renderModal();
    expect(screen.getByRole('link', { name: 'Preview on the Satellite keps tab' })).toHaveAttribute(
      'href',
      '/builds/build-1/satellite-keps',
    );
  });
});
