import { describe, expect, it } from 'vitest';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';

import type { FirmwareChoice, VerifiedStockFirmware } from '../../services/firmwareFlash.ts';
import {
  canAdvance,
  isPreflightComplete,
  firmwareWizardReducer as reduce,
  INITIAL_FIRMWARE_WIZARD_STATE,
  PREFLIGHT_CHECKS,
  type FirmwareWizardState,
} from './firmwareWizardState.ts';

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
