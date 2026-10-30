import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import {
  clearAllOverrides,
  getRt95RadioSettingsSession,
  setShowAdvanced,
} from '../../state/rt95RadioSettingsSession.ts';
import Rt95RadioSettingsEditor from './Rt95RadioSettingsEditor.tsx';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

const { egress: RT95_EGRESS } = newRadioBuildForProfile('proj', 'radio-io-rt95');

let BUILD = 'build-rt95-adv-0';
let seq = 0;

function renderEditor() {
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <Rt95RadioSettingsEditor buildId={BUILD} egress={RT95_EGRESS} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  BUILD = `build-rt95-adv-${++seq}`;
  clearAllOverrides(BUILD);
  setShowAdvanced(BUILD, false);
});

afterEach(() => {
  act(() => {
    clearAllOverrides(BUILD);
    setShowAdvanced(BUILD, false);
  });
});

describe('Rt95RadioSettingsEditor advanced settings', () => {
  it('hides advanced rows until the switch is on', () => {
    renderEditor();
    expect(screen.queryByTestId('advanced-rows')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced settings' }));
    expect(screen.getByTestId('advanced-rows')).toBeInTheDocument();
    expect(document.querySelector('[data-field-id="trfEnable"]')).not.toBeNull();
  });

  it('discards advanced overrides when hiding advanced settings', async () => {
    renderEditor();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced settings' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'TRF Enable' }), {
      target: { value: 'on' },
    });
    expect(getRt95RadioSettingsSession(BUILD).overrides.get('trfEnable')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced settings' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hide and discard' }));
    expect(getRt95RadioSettingsSession(BUILD).overrides.has('trfEnable')).toBe(false);
    expect(getRt95RadioSettingsSession(BUILD).showAdvanced).toBe(false);
  });
});
