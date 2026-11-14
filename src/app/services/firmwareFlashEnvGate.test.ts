import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { DEVELOPER_MODE_KEY, setDeveloperMode } from '@integrations/preferences/developerMode.ts';

import { radioTargetIdsForFirmwareRadio } from '@core/firmware/radioTargets.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';

import {
  isFirmwareUpdaterOfferedOnPlatform,
  listOfferedFirmwareUpdaters,
  resolveFirmwareFlashGate,
} from './firmwareFlashEnvGate.ts';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

const ENVS_PRE_PROD = ['staging', 'main', 'dev', 'local'];

describe('resolveFirmwareFlashGate', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('hides a prod-disabled radio on prod only', () => {
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('hidden');
    for (const env of ENVS_PRE_PROD) {
      expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, env)).toBe('allowed');
    }
  });

  it('allows a radio without the flag everywhere', () => {
    for (const env of ['prod', ...ENVS_PRE_PROD]) {
      expect(resolveFirmwareFlashGate({ prodFlashDisabled: false }, env)).toBe('allowed');
    }
  });

  it('does not exempt Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('hidden');
  });
});

describe('isFirmwareUpdaterOfferedOnPlatform (#1657)', () => {
  afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

  it('passes every setting in a browser, developer mode or not', () => {
    for (const capacitorSupported of [false, true, 'developerMode'] as const) {
      for (const developerMode of [false, true]) {
        expect(
          isFirmwareUpdaterOfferedOnPlatform({ capacitorSupported }, false, developerMode),
        ).toBe(true);
      }
    }
  });

  it('on the Android app: false never, true always, developerMode only with developer mode on', () => {
    for (const developerMode of [false, true]) {
      expect(
        isFirmwareUpdaterOfferedOnPlatform({ capacitorSupported: false }, true, developerMode),
      ).toBe(false);
      expect(
        isFirmwareUpdaterOfferedOnPlatform({ capacitorSupported: true }, true, developerMode),
      ).toBe(true);
    }
    expect(
      isFirmwareUpdaterOfferedOnPlatform({ capacitorSupported: 'developerMode' }, true, false),
    ).toBe(false);
    expect(
      isFirmwareUpdaterOfferedOnPlatform({ capacitorSupported: 'developerMode' }, true, true),
    ).toBe(true);
  });

  it('reads developer mode from this device when the caller does not pass it', () => {
    const dev = { capacitorSupported: 'developerMode' } as const;
    expect(isFirmwareUpdaterOfferedOnPlatform(dev, true)).toBe(false);
    setDeveloperMode(true);
    expect(isFirmwareUpdaterOfferedOnPlatform(dev, true)).toBe(true);
    expect(isFirmwareUpdaterOfferedOnPlatform({ capacitorSupported: false }, true)).toBe(false);
  });
});

describe('listOfferedFirmwareUpdaters', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('offers all three radios on prod', () => {
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).toEqual([
      'baofeng-dm32uv',
      'anytone-at-d890uv',
      'retevis-rt95-head',
    ]);
  });

  it('offers the RT95 front panel on prod, next, dev and staging', () => {
    for (const env of ['prod', 'staging', 'main', 'dev', 'local']) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('retevis-rt95-head');
    }
  });

  it('hides the RT95 main board on prod and offers it on next, dev and staging', () => {
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).not.toContain(
      'retevis-rt95-main',
    );
    for (const env of ENVS_PRE_PROD) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('retevis-rt95-main');
    }
  });

  it('offers the DM-32UV on dev', () => {
    expect(listOfferedFirmwareUpdaters('dev').map((d) => d.radioId)).toContain('baofeng-dm32uv');
  });

  it('hides the UV-5R Mini on prod and offers it on next, dev and staging', () => {
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).not.toContain(
      'baofeng-uv5rmini',
    );
    for (const env of ENVS_PRE_PROD) {
      expect(listOfferedFirmwareUpdaters(env).map((d) => d.radioId)).toContain('baofeng-uv5rmini');
    }
  });

  it('hides the RT95 front panel on Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedFirmwareUpdaters('dev').map((d) => d.radioId)).not.toContain(
      'retevis-rt95-head',
    );
  });

  it('offers nothing on Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    expect(listOfferedFirmwareUpdaters('dev')).toEqual([]);
  });
});

describe('developer mode (#1650)', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
  });
  afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

  const PROD_HIDDEN = ['baofeng-uv5rmini', 'retevis-rt95-main'];

  it('hides the prod-disabled radios on prod with developer mode off', () => {
    const ids = listOfferedFirmwareUpdaters('prod', false).map((d) => d.radioId);
    for (const id of PROD_HIDDEN) expect(ids).not.toContain(id);
  });

  it('offers every radio on prod with developer mode on', () => {
    const ids = listOfferedFirmwareUpdaters('prod', true).map((d) => d.radioId);
    for (const id of PROD_HIDDEN) expect(ids).toContain(id);
    expect(ids).toEqual(listOfferedFirmwareUpdaters('dev', false).map((d) => d.radioId));
  });

  it('offers every radio on pre-prod with developer mode off', () => {
    for (const env of ENVS_PRE_PROD) {
      const ids = listOfferedFirmwareUpdaters(env, false).map((d) => d.radioId);
      for (const id of PROD_HIDDEN) expect(ids).toContain(id);
    }
  });

  it('reads developer mode from this device when the caller does not pass it', () => {
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('hidden');
    setDeveloperMode(true);
    expect(resolveFirmwareFlashGate({ prodFlashDisabled: true }, 'prod')).toBe('allowed');
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).toContain('baofeng-uv5rmini');
  });

  it('relaxes the platform check only for developerMode radios: none marked false is ever offered on Capacitor', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    for (const env of ['prod', ...ENVS_PRE_PROD]) {
      for (const developerMode of [false, true]) {
        for (const d of listOfferedFirmwareUpdaters(env, developerMode)) {
          expect(d.capacitorSupported).not.toBe(false);
          if (d.capacitorSupported === 'developerMode') expect(developerMode).toBe(true);
        }
      }
    }
  });
});

describe('the UV-5R Mini on the Android app (#1657)', () => {
  beforeEach(() => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
  });
  afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

  const ALL_ENVS = ['prod', ...ENVS_PRE_PROD];

  it('is hidden with developer mode off, on every build', () => {
    for (const env of ALL_ENVS) {
      expect(listOfferedFirmwareUpdaters(env, false)).toEqual([]);
    }
  });

  it('is the only radio offered with developer mode on, on every build', () => {
    for (const env of ALL_ENVS) {
      expect(listOfferedFirmwareUpdaters(env, true).map((d) => d.radioId)).toEqual([
        'baofeng-uv5rmini',
      ]);
    }
  });

  it('follows this device switch when the caller does not pass it', () => {
    expect(listOfferedFirmwareUpdaters('dev')).toEqual([]);
    setDeveloperMode(true);
    expect(listOfferedFirmwareUpdaters('dev').map((d) => d.radioId)).toEqual(['baofeng-uv5rmini']);
    expect(listOfferedFirmwareUpdaters('prod').map((d) => d.radioId)).toEqual([
      'baofeng-uv5rmini',
    ]);
  });

  it('leaves the browser unchanged: developer mode adds no radio on pre-prod', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
    for (const env of ENVS_PRE_PROD) {
      expect(listOfferedFirmwareUpdaters(env, true)).toEqual(
        listOfferedFirmwareUpdaters(env, false),
      );
    }
  });
});

describe('no interlock reads developer mode (#1650, #1657)', () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
  const INTERLOCK_ROOTS = [
    'src/integrations/radio-io',
    'src/core/firmware',
    'src/core/services/firmware',
    'src/core/radios',
  ];
  const READS_DEVELOPER_MODE =
    /isDeveloperModeOn|useDeveloperMode|preferences\/developerMode|prodFeatureGate|firmwareFlashEnvGate/;

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it('the updaters, stock checks and radio code never import the switch or a gate', () => {
    const files = INTERLOCK_ROOTS.flatMap((root) => sources(join(repoRoot, root)));
    expect(files.length).toBeGreaterThan(50);
    const readers = files.filter((f) => READS_DEVELOPER_MODE.test(readFileSync(f, 'utf8')));
    expect(readers.map((f) => relative(repoRoot, f))).toEqual([]);
  });
});

describe('radioTargetIdsForFirmwareRadio', () => {
  it('maps each firmware radio to its codeplug targets', () => {
    expect(radioTargetIdsForFirmwareRadio('baofeng-dm32uv')).toEqual([
      'baofeng-dm32uv',
      'baofeng-dm32uv-mm9pdy',
    ]);
    expect(radioTargetIdsForFirmwareRadio('anytone-at-d890uv')).toContain('anytone-at-d890uv');
  });
});
