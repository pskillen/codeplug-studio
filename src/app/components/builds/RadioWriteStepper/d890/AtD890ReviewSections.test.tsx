import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '../../../v2/index.ts';
import {
  clearAllOverrides,
  clearOverride,
  overridesForWrite,
  setOverride,
} from '../../../../state/atD890RadioSettingsSession.ts';
import type { ReviewContext } from '../reviewSections.tsx';
import { AtD890MasterIdNote, atD890ReviewSections } from './AtD890ReviewSections.tsx';
import { createAtD890ReviewController, type AtD890ReviewInit } from './atD890ReviewController.ts';

const BUILD = 'review-language-guard';

function controller(lock: 0 | 1 | 2, over: Partial<AtD890ReviewInit> = {}) {
  return createAtD890ReviewController({
    buildId: BUILD,
    serial: 'SN0001',
    masterIdName: 'X',
    range: { caption: 'x', summary: 'x' } as AtD890ReviewInit['range'],
    receiveOnly: [],
    snapshot: { main: new Uint8Array(0x200), ext: new Uint8Array(0x60) },
    target: 'stock',
    decoded: {},
    languageLock: lock,
    getOverrides: () => overridesForWrite(BUILD),
    onClearLanguage: () => clearOverride(BUILD, 'language'),
    initialSettingsTicked: true,
    sameRadio: true,
    applyToEveryRadio: false,
    settingsOnly: true,
    fullReadHeld: false,
    readRestSeconds: null,
    initialChoice: 'apply',
    initialBackup: { status: 'none' },
    onSaveBackup: () => undefined,
    onReviewSettings: () => undefined,
    onUseStepKeys: () => undefined,
    ...over,
  });
}

function renderSections(c: ReturnType<typeof controller>) {
  return render(
    <DesignSystemV2Provider>
      <div>{atD890ReviewSections({ atD890: c } as unknown as ReviewContext)}</div>
    </DesignSystemV2Provider>,
  );
}

afterEach(() => clearAllOverrides(BUILD));

describe('AtD890 Review language guard', () => {
  it('shows a red line and keeps Write off until the language change is cleared', () => {
    act(() => setOverride(BUILD, 'language', 2));
    const c = controller(1);
    renderSections(c);
    expect(screen.getByTestId('d890-language-blocked')).toHaveTextContent(
      "This radio's region only allows English; the Language change can't be applied.",
    );
    expect(c.canWrite()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Clear the language change' }));
    expect(screen.queryByTestId('d890-language-blocked')).toBeNull();
    // Settings alone, and the language was the only change: nothing left to write.
    expect(c.canWrite()).toBe(false);
  });

  it('shows nothing for an allowed language', () => {
    act(() => setOverride(BUILD, 'language', 0));
    renderSections(controller(1));
    expect(screen.queryByTestId('d890-language-blocked')).toBeNull();
  });
});

describe('AtD890 Review repeater mode check', () => {
  function mainWith(bytes: Record<number, number>) {
    const main = new Uint8Array(0x200);
    for (const [at, v] of Object.entries(bytes)) main[Number(at)] = v;
    return main;
  }
  const snapshot = (bytes: Record<number, number>) => ({
    main: mainWith(bytes),
    ext: new Uint8Array(0x60),
  });

  it('shows the amber line when the applied override turns repeater mode on', () => {
    act(() => setOverride(BUILD, 'repeaterMode', true));
    renderSections(controller(0, { snapshot: snapshot({ 0x2d: 0 }) }));
    expect(screen.getByTestId('d890-repeater-caution')).toHaveTextContent(
      'The radio will switch repeater mode off at start-up: Sub-Channel Mode is off.',
    );
    expect(screen.getByTestId('d890-repeater-mode')).toHaveTextContent(/Studio cannot check that/);
  });

  it('does not count an override that Keep will not write', () => {
    act(() => setOverride(BUILD, 'repeaterMode', true));
    renderSections(
      controller(0, { snapshot: snapshot({}), sameRadio: false, initialChoice: 'keep' }),
    );
    expect(screen.queryByTestId('d890-repeater-mode')).toBeNull();
  });

  it('uses the radio value when nothing is overridden, and passes when the settings are met', () => {
    renderSections(
      controller(0, {
        snapshot: snapshot({ 0x2d: 1 }),
        decoded: { repeaterMode: { value: true, raw: [1] } },
      }),
    );
    expect(screen.queryByTestId('d890-repeater-caution')).toBeNull();
    expect(screen.getByTestId('d890-repeater-mode')).toBeInTheDocument();
  });

  it('is absent when repeater mode is off', () => {
    renderSections(controller(0, { snapshot: snapshot({ 0x2d: 0 }) }));
    expect(screen.queryByTestId('d890-repeater-mode')).toBeNull();
  });
});

describe('AtD890 Review Master Id note', () => {
  const note = (c: ReturnType<typeof controller>) =>
    render(
      <DesignSystemV2Provider>
        <AtD890MasterIdNote controller={c} />
      </DesignSystemV2Provider>,
    );

  it('says per-channel IDs have no effect when the radio has Master Id on', () => {
    note(controller(0, { masterIdSelected: true, settingsOnly: false }));
    expect(screen.getByTestId('d890-master-id-on')).toHaveTextContent(
      'Master Id is on: per-channel ID overrides have no effect',
    );
  });

  it('is absent when Master Id is off, unknown, or the Write sends only settings', () => {
    note(controller(0, { masterIdSelected: false, settingsOnly: false }));
    note(controller(0, { settingsOnly: false }));
    note(controller(0, { masterIdSelected: true, settingsOnly: true }));
    expect(screen.queryByTestId('d890-master-id-on')).toBeNull();
  });
});
