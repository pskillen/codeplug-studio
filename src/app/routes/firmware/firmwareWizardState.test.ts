import { describe, expect, it } from 'vitest';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';

import { getFirmwareUpdater } from '@integrations/radio-io';

import type { FirmwareChoice, VerifiedStockFirmware } from '../../services/firmwareFlash.ts';
import {
  canAdvance,
  firmwareWizardSteps,
  isPreflightComplete,
  isSafetyBackupDone,
  firmwareWizardReducer as reduce,
  INITIAL_FIRMWARE_WIZARD_STATE,
  PREFLIGHT_CHECKS,
  type FirmwareWizardState,
} from './firmwareWizardState.ts';
import { radioCheckSetup } from './radioCheck.ts';

const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
const IMAGE = { provenance: 'stock' } as unknown as PreparedFirmwareImage;
const UNREVIEWED = { provenance: 'unreviewed' } as unknown as LoadedFirmwarePatch;
const BUNDLED = { provenance: 'published' } as unknown as LoadedFirmwarePatch;
const USER_CHOICE: FirmwareChoice = {
  kind: 'user-patch',
  file: { name: 'p.json', bytes: new Uint8Array(0) },
};

function through(...actions: Parameters<typeof reduce>[1][]): FirmwareWizardState {
  return actions.reduce(reduce, INITIAL_FIRMWARE_WIZARD_STATE);
}

describe('firmwareWizardReducer', () => {
  it('needs a radio before moving on', () => {
    expect(canAdvance(INITIAL_FIRMWARE_WIZARD_STATE)).toBe(false);
    expect(reduce(INITIAL_FIRMWARE_WIZARD_STATE, { type: 'next' }).step).toBe('radio');
    const s = through({ type: 'selectRadio', radioId: 'baofeng-dm32uv' }, { type: 'next' });
    expect(s.step).toBe('firmware');
  });

  it('walks every step once each gate is satisfied', () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'next' },
      { type: 'next' },
    );
    expect(s.step).toBe('stock');
    expect(reduce(s, { type: 'next' }).step).toBe('stock');
    s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'next' },
      { type: 'next' },
      { type: 'stockVerified', stock: STOCK },
      { type: 'next' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'next' },
    );
    expect(s.step).toBe('preflight');
    expect(reduce(s, { type: 'next' }).step).toBe('preflight');
    for (const check of PREFLIGHT_CHECKS) s = reduce(s, { type: 'setCheck', check, value: true });
    s = reduce(s, { type: 'next' });
    expect(s.step).toBe('updateMode');
    s = reduce(s, { type: 'next' });
    expect(s.step).toBe('flash');
    expect(canAdvance(s)).toBe(false);
  });

  it('keeps verified stock when going back', () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'next' },
      { type: 'next' },
      { type: 'stockVerified', stock: STOCK },
      { type: 'next' },
    );
    s = reduce(reduce(s, { type: 'back' }), { type: 'back' });
    expect(s.step).toBe('firmware');
    expect(s.stock).toBe(STOCK);
    s = reduce(s, { type: 'goTo', step: 'radio' });
    s = reduce(s, { type: 'selectRadio', radioId: 'baofeng-dm32uv' });
    expect(s.stock).toBe(STOCK);
  });

  it('clears stock, image and checks when the radio changes', () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'stockVerified', stock: STOCK },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'setCheck', check: 'risk', value: true },
    );
    s = reduce(s, { type: 'selectRadio', radioId: 'anytone-at-d890uv' });
    expect(s).toMatchObject({ radioId: 'anytone-at-d890uv', stock: null, image: null });
    expect(s.checks.risk).toBe(false);
  });

  it('refuses a jump past an unsatisfied step', () => {
    const s = through({ type: 'selectRadio', radioId: 'baofeng-dm32uv' });
    expect(reduce(s, { type: 'goTo', step: 'updateMode' }).step).toBe('radio');
    expect(reduce(s, { type: 'goTo', step: 'stock' }).step).toBe('stock');
  });

  it('clears the choice, loaded patch and acceptance when the radio changes', () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'chooseFirmware', choice: USER_CHOICE, loadedPatch: UNREVIEWED },
      { type: 'setRiskAccepted', value: true },
    );
    s = reduce(s, { type: 'selectRadio', radioId: 'anytone-at-d890uv' });
    expect(s.choice).toEqual({ kind: 'stock' });
    expect(s.loadedPatch).toBeNull();
    expect(s.riskAccepted).toBe(false);
  });

  it('keeps verified stock but drops the image and acceptance when the choice changes', () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'chooseFirmware', choice: USER_CHOICE, loadedPatch: UNREVIEWED },
      { type: 'setRiskAccepted', value: true },
      { type: 'stockVerified', stock: STOCK },
      { type: 'imagePrepared', image: IMAGE },
    );
    s = reduce(s, { type: 'chooseFirmware', choice: { kind: 'stock' } });
    expect(s.stock).toBe(STOCK);
    expect(s.image).toBeNull();
    expect(s.riskAccepted).toBe(false);
    expect(s.loadedPatch).toBeNull();
  });

  it('holds the firmware step until an unreviewed patch is accepted', () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'next' },
      { type: 'chooseFirmware', choice: USER_CHOICE, loadedPatch: UNREVIEWED },
    );
    expect(canAdvance(s)).toBe(false);
    expect(reduce(s, { type: 'next' }).step).toBe('firmware');
    s = reduce(s, { type: 'setRiskAccepted', value: true });
    expect(reduce(s, { type: 'next' }).step).toBe('stock');
  });

  it('lets a bundled patch through without acceptance, but not before it is loaded', () => {
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'next' },
      { type: 'chooseFirmware', choice: USER_CHOICE },
    );
    expect(canAdvance(s)).toBe(false);
    expect(
      canAdvance(reduce(s, { type: 'chooseFirmware', choice: USER_CHOICE, loadedPatch: BUNDLED })),
    ).toBe(true);
  });

  it('lets a loaded to-stock patch through without acceptance, but not before it is loaded', () => {
    const choice: FirmwareChoice = { ...USER_CHOICE, kind: 'back-to-stock' };
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-uv5rmini', stockFlashOffered: false },
      { type: 'next' },
      { type: 'chooseFirmware', choice },
    );
    expect(canAdvance(s)).toBe(false);
    const loaded = reduce(s, { type: 'chooseFirmware', choice, loadedPatch: UNREVIEWED });
    expect(loaded.riskAccepted).toBe(false);
    expect(reduce(loaded, { type: 'next' }).step).toBe('stock');
  });

  it('drops the prepared image and checks when new stock is verified', () => {
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'setCheck', check: 'risk', value: true },
      { type: 'stockVerified', stock: STOCK },
    );
    expect(s.image).toBeNull();
    expect(s.checks.risk).toBe(false);
  });

  it('a new radio read drops the prepared image, the confirm and checks; a restart forgets it', () => {
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-uv5rmini' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'setReinstallConfirmed', value: true },
      { type: 'setCheck', check: 'risk', value: true },
      { type: 'radioRead', status: { kind: 'none' } },
    );
    expect(s.radioRead).toEqual({ kind: 'none' });
    expect(s.image).toBeNull();
    expect(s.reinstallConfirmed).toBe(false);
    expect(s.checks.risk).toBe(false);
    expect(reduce(s, { type: 'restart' }).radioRead).toBeNull();
    expect(reduce(s, { type: 'selectRadio', radioId: 'baofeng-dm32uv' }).radioRead).toBeNull();
  });

  it('a new Radio Info answer drops the prepared image and checks', () => {
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-uv5rmini' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'setCheck', check: 'risk', value: true },
      { type: 'setRadioInfo', patch: { firmware: 'V0.27' } },
      { type: 'setRadioInfo', patch: { hardware: 'V1.7' } },
    );
    expect(s.image).toBeNull();
    expect(s.checks.risk).toBe(false);
    expect(s.radioInfo).toEqual({ firmware: 'V0.27', hardware: 'V1.7', suffix: '' });
    expect(reduce(s, { type: 'restart' }).radioInfo.firmware).toBe('');
  });

  it('the reinstall confirm rebuilds the image, and any new answer, stock or choice clears it', () => {
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-uv5rmini' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'setCheck', check: 'risk', value: true },
      { type: 'setReinstallConfirmed', value: true },
    );
    expect(s.reinstallConfirmed).toBe(true);
    expect(s.image).toBeNull();
    expect(s.checks.risk).toBe(false);
    expect(reduce(s, { type: 'setReinstallConfirmed', value: true })).toBe(s);
    expect(reduce(s, { type: 'setRadioInfo', patch: { firmware: 'x' } }).reinstallConfirmed).toBe(
      false,
    );
    expect(reduce(s, { type: 'stockVerified', stock: STOCK }).reinstallConfirmed).toBe(false);
    expect(reduce(s, { type: 'stockCleared' }).reinstallConfirmed).toBe(false);
    expect(
      reduce(s, { type: 'chooseFirmware', choice: { kind: 'stock' } }).reinstallConfirmed,
    ).toBe(false);
    expect(reduce(s, { type: 'restart' }).reinstallConfirmed).toBe(false);
  });

  it('restart returns to a fresh first step', () => {
    const s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv' },
      { type: 'next' },
      { type: 'stockVerified', stock: STOCK },
      { type: 'setCheck', check: 'risk', value: true },
    );
    expect(reduce(s, { type: 'restart' })).toEqual(INITIAL_FIRMWARE_WIZARD_STATE);
  });

  describe('radio pre-flight requirements', () => {
    const REQ = { attestationIds: ['a', 'b'], probe: true };
    const atPreflight = () => {
      let s = through(
        { type: 'selectRadio', radioId: 'baofeng-dm32uv', preflight: REQ },
        { type: 'next' },
        { type: 'next' },
        { type: 'stockVerified', stock: STOCK },
        { type: 'next' },
        { type: 'imagePrepared', image: IMAGE },
        { type: 'next' },
      );
      for (const check of PREFLIGHT_CHECKS) s = reduce(s, { type: 'setCheck', check, value: true });
      return s;
    };

    it('is unchanged for a radio with no requirements', () => {
      let s = through({ type: 'selectRadio', radioId: 'baofeng-dm32uv' });
      for (const check of PREFLIGHT_CHECKS) s = reduce(s, { type: 'setCheck', check, value: true });
      expect(isPreflightComplete(s)).toBe(true);
    });

    it('blocks until every attestation is ticked and the probe passed', () => {
      let s = atPreflight();
      expect(s.step).toBe('preflight');
      expect(canAdvance(s)).toBe(false);
      s = reduce(s, { type: 'setRadioCheck', id: 'a', value: true });
      s = reduce(s, { type: 'setRadioCheck', id: 'b', value: true });
      expect(canAdvance(s)).toBe(false);
      s = reduce(s, { type: 'probePassed', summary: 'ok' });
      expect(canAdvance(s)).toBe(true);
      expect(reduce(s, { type: 'probeCleared' }).probe).toBeNull();
      expect(canAdvance(reduce(s, { type: 'probeCleared' }))).toBe(false);
    });

    it('needs the probe by default and lets the opt-in skip it', () => {
      let s = atPreflight();
      s = reduce(s, { type: 'setRadioCheck', id: 'a', value: true });
      s = reduce(s, { type: 'setRadioCheck', id: 'b', value: true });
      expect(s.probeSkipped).toBe(false);
      expect(canAdvance(s)).toBe(false);
      s = reduce(s, { type: 'setProbeSkipped', value: true });
      expect(canAdvance(s)).toBe(true);
      expect(canAdvance(reduce(s, { type: 'setCheck', check: 'risk', value: false }))).toBe(false);
      expect(canAdvance(reduce(s, { type: 'setRadioCheck', id: 'a', value: false }))).toBe(false);
      expect(reduce(s, { type: 'stockCleared' }).probeSkipped).toBe(false);
    });

    it('resets attestations and the probe on a new choice, new stock or cleared stock', () => {
      let s = atPreflight();
      s = reduce(s, { type: 'setRadioCheck', id: 'a', value: true });
      s = reduce(s, { type: 'probePassed', summary: 'ok' });
      for (const a of [
        { type: 'chooseFirmware', choice: { kind: 'stock' } },
        { type: 'stockVerified', stock: STOCK },
        { type: 'stockCleared' },
      ] as const) {
        const r = reduce(s, a);
        expect(r.radioChecks).toEqual({});
        expect(r.probe).toBeNull();
        expect(r.radioPreflight).toEqual(REQ);
      }
    });

    it('goTo respects the requirement', () => {
      const s = atPreflight();
      expect(reduce(s, { type: 'goTo', step: 'updateMode' }).step).toBe('preflight');
    });
  });
});

describe('retry with the other layout', () => {
  const layoutImage = (radioLayout: string) =>
    ({ provenance: 'published', radioLayout }) as unknown as PreparedFirmwareImage;
  const atFlash: FirmwareWizardState = {
    ...INITIAL_FIRMWARE_WIZARD_STATE,
    step: 'flash',
    radioId: 'baofeng-uv5rmini',
    choice: USER_CHOICE,
    loadedPatch: BUNDLED,
    stock: STOCK,
    image: layoutImage('L1'),
    reinstallConfirmed: true,
    checks: { risk: true, battery: true, cable: true, otherApps: true },
    radioChecks: { attest: true },
    probe: { summary: 'ok' },
    safetyBackupSerial: 'S1',
    safetyBackup: { kind: 'saved', radioKey: 'S1', summary: 'saved' },
  };
  const L2 = layoutImage('L2');

  it('swaps in the other image and goes back to update mode, keeping ticks, probe and backup', () => {
    const s = reduce(atFlash, { type: 'retryOtherLayout', from: 'L1', image: L2 });
    expect(s.step).toBe('updateMode');
    expect(s.image).toBe(L2);
    expect(s.layoutRetry).toEqual({ from: 'L1', to: 'L2' });
    expect(s.reinstallConfirmed).toBe(false);
    expect(s.checks).toBe(atFlash.checks);
    expect(s.radioChecks).toBe(atFlash.radioChecks);
    expect(s.probe).toBe(atFlash.probe);
    expect(s.safetyBackup).toBe(atFlash.safetyBackup);
    expect(canAdvance(s)).toBe(true);
  });

  it('is used once per flash, and never to the refused layout or a layout-less image', () => {
    const once = reduce(atFlash, { type: 'retryOtherLayout', from: 'L1', image: L2 });
    expect(reduce(once, { type: 'retryOtherLayout', from: 'L2', image: layoutImage('L1') })).toBe(
      once,
    );
    expect(
      reduce(atFlash, { type: 'retryOtherLayout', from: 'L1', image: layoutImage('L1') }),
    ).toBe(atFlash);
    expect(reduce(atFlash, { type: 'retryOtherLayout', from: 'L1', image: IMAGE })).toBe(atFlash);
  });

  it('a new choice, stock or radio answer starts a new flash with the retry unused', () => {
    const once = reduce(atFlash, { type: 'retryOtherLayout', from: 'L1', image: L2 });
    expect(reduce(once, { type: 'chooseFirmware', choice: USER_CHOICE }).layoutRetry).toBeNull();
    expect(reduce(once, { type: 'stockVerified', stock: STOCK }).layoutRetry).toBeNull();
    expect(reduce(once, { type: 'stockCleared' }).layoutRetry).toBeNull();
    expect(
      reduce(once, { type: 'setRadioInfo', patch: { firmware: 'V0.27' } }).layoutRetry,
    ).toBeNull();
    expect(reduce(once, { type: 'radioRead', status: null }).layoutRetry).toBeNull();
    expect(reduce(once, { type: 'restart' }).layoutRetry).toBeNull();
    // Going back and forth keeps it.
    expect(reduce(once, { type: 'back' }).layoutRetry).toEqual({ from: 'L1', to: 'L2' });
  });
});

describe('safety backup requirement', () => {
  const REQ = { attestationIds: [], probe: true, safetyBackup: true };
  const TAKEN = {
    kind: 'taken' as const,
    radioKey: 'AB 1',
    summary: 's',
    region: 'cal',
    fileName: 'f.zip',
    sha256: 'aa',
    fingerprint: 'ff',
    ticked: false,
  };
  const atPreflight = () => {
    let s = through(
      { type: 'selectRadio', radioId: 'baofeng-dm32uv', preflight: REQ },
      { type: 'next' },
      { type: 'next' },
      { type: 'stockVerified', stock: STOCK },
      { type: 'next' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'next' },
    );
    for (const check of PREFLIGHT_CHECKS) s = reduce(s, { type: 'setCheck', check, value: true });
    return reduce(s, { type: 'setProbeSkipped', value: true });
  };

  it('blocks Continue, even with the probe skipped, until saved', () => {
    const s = atPreflight();
    expect(s.probeSkipped).toBe(true);
    expect(canAdvance(s)).toBe(false);
    expect(canAdvance(reduce(s, { type: 'safetyBackupResult', status: TAKEN }))).toBe(false);
  });

  it('already saved passes; a taken backup needs the tick', () => {
    const saved = reduce(atPreflight(), {
      type: 'safetyBackupResult',
      status: { kind: 'saved', radioKey: 'AB 1', summary: 's' },
    });
    expect(canAdvance(saved)).toBe(true);
    let taken = reduce(atPreflight(), { type: 'safetyBackupResult', status: TAKEN });
    expect(isSafetyBackupDone(taken)).toBe(false);
    taken = reduce(taken, { type: 'safetyBackupTicked' });
    expect(canAdvance(taken)).toBe(true);
  });

  it('typing another serial discards the result; picking another radio clears everything', () => {
    let s = reduce(atPreflight(), { type: 'setSafetyBackupSerial', value: 'AB 1' });
    s = reduce(s, { type: 'safetyBackupResult', status: TAKEN });
    expect(reduce(s, { type: 'setSafetyBackupSerial', value: 'AB 2' }).safetyBackup).toBeNull();
    const other = reduce(s, { type: 'selectRadio', radioId: 'baofeng-uv5rmini' });
    expect(other.safetyBackup).toBeNull();
    expect(other.safetyBackupSerial).toBe('');
  });

  it('a radio without the requirement is unaffected', () => {
    let s = through({ type: 'selectRadio', radioId: 'baofeng-dm32uv' });
    for (const check of PREFLIGHT_CHECKS) s = reduce(s, { type: 'setCheck', check, value: true });
    expect(isPreflightComplete(s)).toBe(true);
  });
});

it('requires a firmware choice when plain stock is unavailable', () => {
  const selected = through(
    { type: 'selectRadio', radioId: 'baofeng-uv5rmini', stockFlashOffered: false },
    { type: 'next' },
  );
  expect(selected.choice).toBeNull();
  expect(canAdvance(selected)).toBe(false);
  const cleared = reduce(selected, { type: 'chooseFirmware', choice: null });
  expect(canAdvance(cleared)).toBe(false);
});

describe('the "Your radio" check step (#1670)', () => {
  const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;
  const selectMini = {
    type: 'selectRadio',
    radioId: MINI.radioId,
    radioCheck: radioCheckSetup(MINI),
  } as const;
  /** A release with a file only for the stock NRF V0.27 radio (L2 on nrf-v0.27). */
  const RELEASE_L2 = {
    provenance: 'published',
    layout: 'L2',
    parsed: { description: { base: 'nrf-v0.27' } },
  } as unknown as LoadedFirmwarePatch;
  const atCheck = (loadedPatch: LoadedFirmwarePatch | null = RELEASE_L2) =>
    through(
      selectMini,
      { type: 'next' },
      { type: 'chooseFirmware', choice: USER_CHOICE, loadedPatch },
      { type: 'next' },
    );
  const answer = (firmware: string, suffix: string, hardware = 'V1.7') =>
    ({ type: 'setRadioInfo', patch: { firmware, suffix, hardware } }) as const;
  const noReport = { type: 'radioRead', status: { kind: 'none' } } as const;
  const answered = (a: ReturnType<typeof answer>) => reduce(reduce(atCheck(), noReport), a);

  it('comes between Firmware and Stock firmware, only for a radio with a radio check', () => {
    expect(firmwareWizardSteps(through(selectMini))).toEqual([
      'radio',
      'firmware',
      'check',
      'stock',
      'prepare',
      'preflight',
      'updateMode',
      'flash',
    ]);
    const dm32 = through({ type: 'selectRadio', radioId: 'baofeng-dm32uv' });
    expect(firmwareWizardSteps(dm32)).not.toContain('check');
    expect(reduce(reduce(dm32, { type: 'next' }), { type: 'next' }).step).toBe('stock');
    expect(reduce(dm32, { type: 'goTo', step: 'check' }).step).toBe('radio');
  });

  it('stops an unread or unanswered radio before the stock-file step', () => {
    for (const s of [atCheck(), reduce(atCheck(), noReport)]) {
      expect(s.step).toBe('check');
      expect(canAdvance(s)).toBe(false);
      expect(reduce(s, { type: 'next' }).step).toBe('check');
      expect(reduce(s, { type: 'goTo', step: 'stock' }).step).toBe('check');
    }
  });

  it('stops an unsupported radio at the check step', () => {
    for (const a of [
      answer('V0.04', 'NRF'),
      answer('Other', 'NRF'),
      answer('V0.27', 'Other'),
      answer('V0.27', 'NRF', 'Other'),
    ]) {
      const s = answered(a);
      expect(canAdvance(s)).toBe(false);
      expect(reduce(s, { type: 'next' }).step).toBe('check');
    }
  });

  it('stops a radio the chosen release has no file for, and lets it on with no release chosen', () => {
    expect(canAdvance(answered(answer('V0.04', 'NRFB')))).toBe(false);
    // No release yet (plain stock, say): the release is checked again once one is chosen.
    expect(canAdvance({ ...answered(answer('V0.04', 'NRFB')), loadedPatch: null })).toBe(true);
  });

  it('checks the radio again when the release changes after the check passed', () => {
    /** A release with a file only for the NRFB V0.04 radio (L1 on nrfb-v0.04). */
    const RELEASE_L1 = {
      provenance: 'published',
      layout: 'L1',
      parsed: { description: { base: 'nrfb-v0.04' } },
    } as unknown as LoadedFirmwarePatch;
    let s = answered(answer('V0.27', 'NRF'));
    expect(canAdvance(s)).toBe(true);
    s = reduce(s, { type: 'goTo', step: 'firmware' });
    expect(s.step).toBe('firmware');
    s = reduce(s, { type: 'chooseFirmware', choice: USER_CHOICE, loadedPatch: RELEASE_L1 });
    s = reduce(s, { type: 'next' });
    expect(s.step).toBe('check');
    expect(canAdvance(s)).toBe(false);
    expect(reduce(s, { type: 'next' }).step).toBe('check');
    expect(reduce(s, { type: 'goTo', step: 'prepare' }).step).toBe('check');
  });

  it('lets a supported radio on to the stock-file step, and back to the check', () => {
    const s = reduce(answered(answer('V0.27', 'NRF')), { type: 'next' });
    expect(s.step).toBe('stock');
    expect(reduce(s, { type: 'back' }).step).toBe('check');
  });

  it('a changed answer drops the prepared image and the before-you-flash ticks', () => {
    let s = answered(answer('V0.27', 'NRF'));
    for (const a of [
      { type: 'next' },
      { type: 'stockVerified', stock: STOCK },
      { type: 'next' },
      { type: 'imagePrepared', image: IMAGE },
      { type: 'next' },
      { type: 'setCheck', check: 'battery', value: true },
    ] as const) {
      s = reduce(s, a);
    }
    expect(s.step).toBe('preflight');
    s = reduce(s, { type: 'goTo', step: 'check' });
    expect(s.step).toBe('check');
    s = reduce(s, answer('V0.04', 'NRFB'));
    expect(s.image).toBeNull();
    expect(s.checks.battery).toBe(false);
    expect(s.stock).toBe(STOCK);
    expect(reduce(s, { type: 'goTo', step: 'prepare' }).step).toBe('check');
  });

  it('a radio change or restart forgets the check', () => {
    const s = atCheck();
    expect(reduce(s, { type: 'restart' }).radioCheck).toBeNull();
    expect(reduce(s, { type: 'selectRadio', radioId: 'baofeng-dm32uv' }).radioCheck).toBeNull();
  });
});
