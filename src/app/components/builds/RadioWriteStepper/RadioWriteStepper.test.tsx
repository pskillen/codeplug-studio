import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import RadioWriteStepper from './RadioWriteStepper.tsx';
import {
  demoFlowView,
  demoShellOptions,
  demoStepperConfig,
  noopActions,
} from './stepperDemo.ts';
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
  it('a radio without restart or check counts five steps', () => {
    renderStepper(
      {},
      {
        options: demoShellOptions({
          restartAfterEndSeconds: 0,
          check: { available: false },
          keps: undefined,
        }),
      },
    );
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('1 of 5 · What to write');
  });

  it('shows the step bar and defaults: codeplug ticked, contacts and keps not', () => {
    renderStepper();
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('1 of 6 · What to write');
    expect(screen.getByRole('checkbox', { name: 'Codeplug' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Digital contacts' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Satellite keps' })).not.toBeChecked();
    expect(
      screen.getByText('Anything not ticked stays as it is on the radio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read & write' })).toBeEnabled();
  });

  it('does not show rows the radio does not support, nor a Radio settings row', () => {
    renderStepper(
      {},
      {
        options: demoShellOptions({ parts: { contacts: false, keps: false, settings: false } }),
      },
    );
    expect(screen.queryByRole('checkbox', { name: 'Digital contacts' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Satellite keps' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Radio settings' })).toBeNull();
  });

  it('disables Read & write with nothing ticked', () => {
    renderStepper({ parts: { codeplug: false, contacts: false, settings: false, keps: false } });
    expect(screen.getByRole('button', { name: 'Read & write' })).toBeDisabled();
  });

  it('shows the contact source only while contacts is ticked', () => {
    renderStepper({ parts: { codeplug: true, contacts: true, settings: false, keps: false } });
    expect(screen.getByRole('button', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID directory' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull();
  });

  it('reports ticks and Read & write', () => {
    const actions = renderStepper();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Satellite keps' }));
    expect(actions.onPartsChange).toHaveBeenCalledWith({
      codeplug: true,
      contacts: false,
      settings: false,
      keps: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Read & write' }));
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

  it('Read shows elapsed time on a radio without a read plan', () => {
    renderStepper({
      step: 'connectRead',
      busy: true,
      readRows: [],
      readStartedAt: Date.now() - 12_000,
      progress: { cur: 0, max: 0, msg: 'Reading' },
    });
    expect(screen.getByTestId('stage-progress-elapsed')).toHaveTextContent('Elapsed');
  });

  it('step 2 shows the read progress, the identity and a Cancel that aborts', () => {
    const actions = renderStepper({
      step: 'connectRead',
      busy: true,
      readStartedAt: Date.now() - 5000,
      progress: { cur: 5, max: 10, msg: 'Zones' },
      identity,
    });
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('2 of 6 · Read');
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

  it('Review reads Review if needed before the read finishes', () => {
    renderStepper({ step: 'connectRead', busy: true, reviewDecision: 'undecided' });
    expect(screen.getByText('Review if needed')).toBeInTheDocument();
  });

  it('Review not needed this time is not counted', () => {
    renderStepper(
      { step: 'writing', reviewDecision: 'skipped' },
      {
        options: demoShellOptions({
          restartAfterEndSeconds: 0,
          check: { available: false },
          keps: undefined,
        }),
      },
    );
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('3 of 4 · Writing');
    expect(screen.getByText('Review not needed this time')).toBeInTheDocument();
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

  it('Review Cancel says the radio restarts only when it restarts after END', () => {
    renderStepper(
      { step: 'review', review: { channelCount: 0, contactsNote: null, kepsCount: null, estimateSeconds: null, identityOnly: false, sections: [] } },
      { options: demoShellOptions({ restartAfterEndSeconds: 20 }) },
    );
    expect(screen.getByText(/the radio restarts \(about 20 s\)/)).toBeInTheDocument();
    renderStepper(
      { step: 'review', review: { channelCount: 0, contactsNote: null, kepsCount: null, estimateSeconds: null, identityOnly: false, sections: [] } },
      { options: demoShellOptions({ restartAfterEndSeconds: 0 }) },
    );
    expect(screen.getByText('Nothing has been written yet. Cancel leaves the radio as it is.')).toBeInTheDocument();
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

  it('shows an error with Reconnect and try again when the flow offers it', () => {
    const actions = renderStepper({
      step: 'review',
      errorOutcome: {
        kind: 'error',
        retry: 'reconnect',
        sent: 'nothing-sent',
        message: 'No reply from the radio',
        debugText: 'error: timeout\ncode: none',
        code: 'timeout',
      },
      retryLabel: 'Reconnect and try again',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect and try again' }));
    expect(actions.onRetry).toHaveBeenCalled();
  });

  it('shows the error message intact with Debug details even when the module gave no debug text', () => {
    renderStepper({
      step: 'writing',
      errorOutcome: {
        kind: 'error',
        retry: 'rewrite',
        sent: 'may-hold-part',
        message:
          "OpenGD77 refused FINISH for FLASH sector 0x9c000 (sector 3 of 12): radio answered '-'.",
        debugText: 'Last 2 radio frames (oldest first):\n+000010ms TX    58 03\n+000012ms RX    2d',
        code: 'protocol',
      },
      retryLabel: 'Write again',
    });
    expect(screen.getByTestId('write-stepper-error')).toHaveTextContent(
      "OpenGD77 refused FINISH for FLASH sector 0x9c000 (sector 3 of 12): radio answered '-'.",
    );
    expect(screen.getByTestId('write-stepper-error-debug')).toHaveTextContent('TX 58 03');
    expect(screen.getByRole('button', { name: 'Copy debug text' })).toBeInTheDocument();
    expect(screen.getByText('Debug details')).toBeInTheDocument();
  });
});

describe('RadioWriteStepper — steps 4 to 6', () => {
  it('step 4 shows the planned list and Cancel aborts', () => {
    const actions = renderStepper({
      step: 'writing',
      busy: true,
      reviewDecision: 'skipped',
      writeRows: [
        { id: 'a', label: 'Channels', status: 'success', weight: 100 },
        { id: 'b', label: 'Zones', status: 'active', weight: 100 },
        { id: 'c', label: 'Upload', status: 'pending', weight: 100 },
      ],
    });
    expect(screen.getByTestId('egress-step-label')).toHaveTextContent('3 of 5 · Writing');
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.onAbort).toHaveBeenCalled();
  });

  it('Restart & check shows Restart, Check write and Keps after restart as groups', () => {
    renderStepper({
      step: 'restartCheck',
      busy: true,
      restartSecondsLeft: 0,
      checkStatus: 'running',
      kepsAfterRestart: 'running',
      checkStartedAt: Date.now() - 8000,
      writeRows: [{ id: 'a', label: 'Verify channels', status: 'active', weight: 100 }],
    });
    expect(screen.getByText('Restart')).toBeInTheDocument();
    expect(screen.getByText('Check write')).toBeInTheDocument();
    expect(screen.getByText('Keps after restart')).toBeInTheDocument();
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
      {
        options: demoShellOptions({ successNote: 'Power-cycle the radio.' }),
      },
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
      { options: demoShellOptions({ contactStore: 'separate-lookup-database' }) },
    );
    expect(
      screen.getByText(/Contacts always go to the radio's Contacts list with the codeplug/),
    ).toBeInTheDocument();
    expect(screen.getByText(/This part writes the radio's ID database/)).toBeInTheDocument();
  });
});
