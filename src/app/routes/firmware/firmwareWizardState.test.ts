import { describe, expect, it } from 'vitest';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { VerifiedStockFirmware } from '../../services/firmwareFlash.ts';
import {
  canAdvance,
  firmwareWizardReducer as reduce,
  INITIAL_FIRMWARE_WIZARD_STATE,
  PREFLIGHT_CHECKS,
  type FirmwareWizardState,
} from './firmwareWizardState.ts';

const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
const IMAGE = { provenance: 'stock' } as unknown as PreparedFirmwareImage;

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
});
