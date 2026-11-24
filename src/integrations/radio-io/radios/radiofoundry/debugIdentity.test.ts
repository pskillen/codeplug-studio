import { describe, expect, it } from 'vitest';
import {
  RADIOFOUNDRY_DEBUG_IDDB_SIDECAR,
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_DEBUG_VERSION_SIDECAR,
} from './debugCapture.ts';
import { makeFakeRadioFoundryInfoBody } from './__fixtures__/fakeRadioFoundryRadio.ts';
import { radioFoundryIdentityRows } from './debugIdentity.ts';

const rows = (input: Parameters<typeof radioFoundryIdentityRows>[0]) =>
  Object.fromEntries(radioFoundryIdentityRows(input));

describe('radioFoundryIdentityRows', () => {
  it('shows Not read yet when there is no archive', () => {
    const r = rows({ connection: 'Not connected', family: 'RadioFoundry' });
    expect(r['Firmware · read']).toBe('Not read yet');
    expect(r['Connection']).toBe('Not connected');
    expect(r['Serial']).toBe('None reported');
  });

  it('builds rows from synthetic sidecars', () => {
    const info = makeFakeRadioFoundryInfoBody(0x800000, 0x03);
    const version = new TextEncoder().encode(
      'proto=1\ngit=454a5b76\ngit_time=1795365604\nrelease=1.0\nsource=official\nrepo=github.com/example\nboard=MD-9600\nfeatures=foo, bar\noff=baz\n',
    );
    const iddb = new Uint8Array([0x4e, 0x96, 0xdc, 0x04, 0x00]);
    const r = rows({
      archive: {
        manifest: { radioModelId: 'MD-9600-RadioFoundry', regions: [] },
        regions: {},
        sidecars: {
          [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: info,
          [RADIOFOUNDRY_DEBUG_VERSION_SIDECAR]: version,
          [RADIOFOUNDRY_DEBUG_IDDB_SIDECAR]: iddb,
        },
        source: 'live-read',
      },
      connection: 'Read complete · disconnected',
      family: 'RadioFoundry',
    });
    expect(r['Firmware · read']).toMatch(/^RadioFoundry/);
    expect(r['Board · VERSION']).toBe('MD-9600');
    expect(r['Release · git · VERSION']).toContain('454a5b76');
    expect(r['Source · VERSION']).toBe('official · github.com/example');
    expect(r['Features · VERSION']).toBe('foo, bar · off: baz');
    expect(r['Protocol · INFO']).toContain('staged writes yes');
    expect(r['Protocol · INFO']).toContain('storage writable yes');
    expect(r['DMR ID database · IDDB']).toBe('format N · 318614 records');
  });

  it('says VERSION not reported when INFO exists without VERSION', () => {
    const r = rows({
      archive: {
        manifest: { radioModelId: 'DM-32UV-RadioFoundry', regions: [] },
        regions: {},
        sidecars: {
          [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: makeFakeRadioFoundryInfoBody(0x10000),
        },
        source: 'file',
      },
      connection: 'Imported',
      family: 'RadioFoundry',
    });
    expect(r['Firmware · read']).toBe('INFO answered, VERSION not reported');
  });

  it('formats IDDB format none when the format byte is zero', () => {
    const r = rows({
      archive: {
        manifest: { radioModelId: 'DM-32UV-RadioFoundry', regions: [] },
        regions: {},
        sidecars: {
          [RADIOFOUNDRY_DEBUG_IDDB_SIDECAR]: new Uint8Array([0, 0, 0, 0, 0]),
        },
        source: 'file',
      },
      connection: 'Imported',
      family: 'RadioFoundry',
    });
    expect(r['DMR ID database · IDDB']).toBe('format none · 0 records');
  });

  it('says Not reported when IDDB is absent', () => {
    const r = rows({
      archive: {
        manifest: { radioModelId: 'DM-32UV-RadioFoundry', regions: [] },
        regions: {},
        sidecars: {},
        source: 'file',
      },
      connection: 'Imported',
      family: 'RadioFoundry',
    });
    expect(r['DMR ID database · IDDB']).toBe('Not reported');
  });
});