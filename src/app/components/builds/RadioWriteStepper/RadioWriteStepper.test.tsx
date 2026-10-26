import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import RadioWriteStepper from './RadioWriteStepper.tsx';
import { demoFlowView, demoStepperConfig, noopActions } from './testFlow.ts';
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
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RadioID' })).toBeInTheDocument();
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
