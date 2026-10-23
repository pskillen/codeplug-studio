import { describe, expect, it, vi } from 'vitest';
import { mm9pdyStepKeysDescription } from './mm9pdyStepKeysCopy.ts';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { DigitalContactsWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import WriteRadioModal from './WriteRadioModal.tsx';
import { channelLocationWriteRadioNote } from '@core/radio-targets/channelLocationNotes.ts';

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

  it('shows the MM9PDY step-key switch only when the build can save it', () => {
    renderModal();
    expect(screen.queryByRole('switch', { name: /Assign TG previous and TG next/ })).toBeNull();

    const onAssignMm9pdyStepKeysChange = vi.fn();
    renderModal({
      assignMm9pdyStepKeys: false,
      assignMm9pdyStepKeysDescription: mm9pdyStepKeysDescription('anytone-at-d890uv-mm9pdy'),
      onAssignMm9pdyStepKeysChange,
    });
    const toggle = screen.getByRole('switch', { name: /Assign TG previous and TG next/ });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/item 15 Record/)).toBeInTheDocument();
    expect(screen.getByText(/item 14 Record Switch/)).toBeInTheDocument();
    expect(screen.getByText(/MM9PDY names/)).toBeInTheDocument();
    expect(mm9pdyStepKeysDescription('baofeng-dm32uv-mm9pdy')).toMatch(/Previous Record.*TG Next/);
    fireEvent.click(toggle);
    expect(onAssignMm9pdyStepKeysChange).toHaveBeenCalledWith(true);
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

  it('shows keps last-updated and a library refresh link', () => {
    renderModal({ kepsLastUpdatedIso: '2026-08-10T12:00:00.000Z' });
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Update in Library' })).toHaveAttribute(
      'href',
      '/library/satellite-keps',
    );
  });

  it('shows never refreshed when keps last-updated is unset', () => {
    renderModal({ kepsLastUpdatedIso: null });
    expect(screen.getByText(/Never refreshed/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Update in Library' })).toBeInTheDocument();
  });
});

describe('WriteRadioModal channel position notes (#1383)', () => {
  const counts = { written: 3, noPosition: 1, useLocationOff: 0, overCapacity: 0 };

  it('shows the written count on the MM9PDY targets', () => {
    for (const target of ['anytone-at-d890uv-mm9pdy', 'baofeng-dm32uv-mm9pdy']) {
      const note = channelLocationWriteRadioNote(target, { counts, locatedChannels: 3 });
      const { unmount } = renderModal({ channelLocationNote: note });
      expect(screen.getByTestId('write-radio-channel-location-note')).toHaveTextContent(
        /3 channel positions are written\. A later write from the official CPS or a stock target/,
      );
      expect(screen.getByRole('button', { name: 'Write codeplug' })).toBeEnabled();
      unmount();
    }
  });

  it('points stock AT-D890UV and DM-32UV targets at the MM9PDY target', () => {
    for (const target of ['anytone-at-d890uv', 'baofeng-dm32uv']) {
      const note = channelLocationWriteRadioNote(target, { locatedChannels: 2 });
      const { unmount } = renderModal({ channelLocationNote: note });
      expect(screen.getByTestId('write-radio-channel-location-note')).toHaveTextContent(
        /2 channels in this build have a position\. .*MM9PDY modded firmware target writes them/,
      );
      unmount();
    }
  });

  it('shows nothing without located channels or on targets with no MM9PDY sibling', () => {
    expect(
      channelLocationWriteRadioNote('anytone-at-d890uv-mm9pdy', {
        counts: { ...counts, written: 0 },
        locatedChannels: 0,
      }),
    ).toBeNull();
    expect(channelLocationWriteRadioNote('anytone-at-d890uv', { locatedChannels: 0 })).toBeNull();
    expect(channelLocationWriteRadioNote('baofeng-dm1701', { locatedChannels: 4 })).toBeNull();
    expect(channelLocationWriteRadioNote('baofeng-uv5r-mini', { locatedChannels: 4 })).toBeNull();
    renderModal({ channelLocationNote: null });
    expect(screen.queryByTestId('write-radio-channel-location-note')).not.toBeInTheDocument();
  });
});
