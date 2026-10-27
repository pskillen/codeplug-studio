import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import RadioWriteStepper from './RadioWriteStepper.tsx';
import { demoFlowView, demoStepperConfig, noopActions } from './stepperDemo.ts';
import type { WriteFlowView, WriteStepperConfig } from './types.ts';

function renderStepper(
  view: Partial<WriteFlowView> = {},
  config: Partial<WriteStepperConfig> = {},
  actions = noopActions(() => vi.fn()),
) {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <RadioWriteStepper
          config={demoStepperConfig(config)}
          view={demoFlowView(view)}
          actions={actions}
        />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  return actions;
}

describe('RadioWriteStepper — step 1, what to write', () => {
  it('shows the step bar and defaults: codeplug ticked, contacts and keps not', () => {
    renderStepper();
    expect(screen.getByTestId('write-stepper-step-label')).toHaveTextContent(
      '1 of 6 · What to write',
    );
    expect(screen.getByRole('checkbox', { name: 'Codeplug' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Digital contacts' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
    expect(
      screen.getByText('Anything not ticked stays as it is on the radio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect & read' })).toBeEnabled();
  });

  it('does not show rows the radio does not support, nor a Radio settings row', () => {
    renderStepper({}, { support: { contacts: false, keps: false, settings: false } });
    expect(screen.queryByRole('checkbox', { name: 'Digital contacts' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Satellite keps' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Radio settings' })).toBeNull();
  });

  it('disables Connect & read with nothing ticked', () => {
    renderStepper({ parts: { codeplug: false, contacts: false, settings: false, keps: false } });
    expect(screen.getByRole('button', { name: 'Connect & read' })).toBeDisabled();
  });

  it('shows the contact source only while contacts is ticked', () => {
    renderStepper({ parts: { codeplug: true, contacts: true, settings: false, keps: false } });
    expect(screen.getByRole('button', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID directory' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull();
  });

  it('reports ticks and Connect & read', () => {
    const actions = renderStepper();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Satellite keps' }));
    expect(actions.onPartsChange).toHaveBeenCalledWith({
      codeplug: true,
      contacts: false,
      settings: false,
      keps: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect & read' }));
    expect(actions.onConnectAndRead).toHaveBeenCalled();
  });

  it('shows the MM9PDY step-key switch under the ticked codeplug', () => {
    const onChange = vi.fn();
    renderStepper(
      {},
      { stepKeys: { checked: false, description: 'P1/P2 become TG keys.', onChange } },
    );
    fireEvent.click(screen.getByRole('switch', { name: /Assign TG previous and TG next/ }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('RadioWriteStepper — steps 2 and 3', () => {
  const identity = { model: 'AT-D890UV', serial: 'ABC1234567', name: 'MM9PDY-2' };

  it('step 2 shows the read progress, the identity and a Cancel that aborts', () => {
    const actions = renderStepper({
      step: 'connectRead',
      busy: true,
      progress: { cur: 5, max: 10, msg: 'Zones' },
      identity,
    });
    expect(screen.getByTestId('write-stepper-step-label')).toHaveTextContent('2 of 6 · Read');
    expect(screen.getByText('MM9PDY-2')).toBeInTheDocument();
    // The serial isn't sensitive: shown in full.
    expect(screen.getByText('ABC1234567')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.onAbort).toHaveBeenCalled();
  });

  it('step 2 says when it is reconnecting', () => {
    renderStepper({ step: 'connectRead', busy: true, reconnecting: true });
    expect(screen.getByText(/the radio may have left programming mode/)).toBeInTheDocument();
  });

  it.each([
    [{ codeplug: true, contacts: false, settings: false, keps: false }, 'Write codeplug'],
    [{ codeplug: true, contacts: true, settings: false, keps: false }, 'Write codeplug + contacts'],
    [{ codeplug: false, contacts: false, settings: false, keps: true }, 'Write keps'],
    [{ codeplug: true, contacts: true, settings: false, keps: true }, 'Write 3 parts'],
  ])('step 3 labels the primary button from the ticks %j', (parts, label) => {
    const actions = renderStepper({
      step: 'review',
      parts,
      review: {
        channelCount: 12,
        contactsNote: null,
        kepsCount: null,
        estimateSeconds: 100,
        identityOnly: false,
        sections: [<div key="a">Section A</div>],
      },
    });
    expect(screen.getByText('Section A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(actions.onWrite).toHaveBeenCalled();
  });

  it('step 3 Cancel is the secondary action and writes nothing', () => {
    const actions = renderStepper({
      step: 'review',
      review: {
        channelCount: 1,
        contactsNote: null,
        kepsCount: null,
        estimateSeconds: null,
        identityOnly: false,
        sections: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.onCancelReview).toHaveBeenCalled();
    expect(actions.onWrite).not.toHaveBeenCalled();
  });

  it('shows an error with Reconnect and read again when the flow offers it', () => {
    const actions = renderStepper({
      step: 'review',
      error: 'No reply from the radio',
      canReconnect: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect and read again' }));
    expect(actions.onReconnect).toHaveBeenCalled();
  });
});

describe('RadioWriteStepper — steps 4 to 6', () => {
  it('step 4 shows the planned list and Cancel aborts', () => {
    const actions = renderStepper({
      step: 'writing',
      busy: true,
      writeRows: [
        { id: 'a', label: 'Channels', status: 'success', weight: 100 },
        { id: 'b', label: 'Zones', status: 'active', weight: 100 },
        { id: 'c', label: 'Upload', status: 'pending', weight: 100 },
      ],
    });
    expect(screen.getByTestId('write-stepper-step-label')).toHaveTextContent('4 of 6 · Writing');
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.onAbort).toHaveBeenCalled();
  });

  it('step 5 waits for the restart, then offers Check write and Write keps', () => {
    const actions = renderStepper({
      step: 'restartCheck',
      restartSecondsLeft: 12,
      checkStatus: 'available',
      kepsAfterRestart: 'pending',
    });
    expect(screen.getByTestId('write-stepper-restart-wait')).toHaveTextContent(
      'Waiting for the radio to restart (about 20 s)',
    );
    expect(screen.getByRole('button', { name: 'Check write' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Write keps' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish without keps' }));
    expect(actions.onSkipCheck).toHaveBeenCalled();
  });

  it('step 5 enables the check once the radio is back', () => {
    const actions = renderStepper({
      step: 'restartCheck',
      restartSecondsLeft: 0,
      checkStatus: 'available',
    });
    expect(screen.queryByRole('button', { name: 'Write keps' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check write' }));
    expect(actions.onCheckWrite).toHaveBeenCalled();
  });

  it('step 6 summarises, notes the check, and offers Write another radio and Close', () => {
    const actions = renderStepper(
      {
        step: 'done',
        summary: {
          codeplugWritten: true,
          contactsWritten: false,
          settingsChanged: null,
          settingsTicked: false,
          channelCount: 412,
          kepsResult: null,
          kepsTicked: false,
          kepsError: null,
          warnings: [],
          checkStatus: 'skipped',
          checkResult: null,
          identity: { model: 'AT-D890UV', serial: 'ABCD1234', name: 'MM9PDY-2' },
          writeTimings: null,
        },
      },
      { successNote: 'Power-cycle the radio.' },
    );
    expect(screen.getByText('Codeplug written (412 channels).')).toBeInTheDocument();
    expect(screen.getByText('Check write: skipped.')).toBeInTheDocument();
    expect(screen.getByText('Power-cycle the radio.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy write timings' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write another radio' }));
    expect(actions.onWriteAnother).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(actions.onClose).toHaveBeenCalled();
  });
});

describe('RadioWriteStepper — AT-D890 contacts hint (#1433)', () => {
  it('says contacts ride with the codeplug and the part writes the ID database', () => {
    renderStepper(
      { parts: { codeplug: true, contacts: true, settings: false, keps: false } },
      { separateLookupDatabaseNote: true },
    );
    expect(
      screen.getByText(/Contacts always go to the radio's Contacts list with the codeplug/),
    ).toBeInTheDocument();
    expect(screen.getByText(/This part writes the radio's ID database/)).toBeInTheDocument();
  });
});
