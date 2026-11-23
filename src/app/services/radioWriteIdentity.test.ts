import { describe, expect, it, vi } from 'vitest';
import { summariseRadioFoundryBuild } from '@core/radios/radiofoundry/firmware.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from '@integrations/radio-io/radios/radiofoundry/board.ts';
import { DM32_RADIOFOUNDRY_DESCRIPTOR } from '@integrations/radio-io/radios/radiofoundry/descriptor.ts';
import { createRadioFoundryCableProtocol } from '@integrations/radio-io/radios/radiofoundry/protocol.ts';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import type { BytePipe, CloneImageRadio, RadioDescriptor } from '@integrations/radio-io/types.ts';
import { radioWriteIdentityFromSession } from './radioIoSession.ts';

const pipe: BytePipe = {
  write: async () => {},
  readExact: async () => new Uint8Array(0),
  close: async () => {},
};

function foundrySession(build: Parameters<typeof summariseRadioFoundryBuild>[0]) {
  const radio = createRadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
  vi.spyOn(radio, 'firmwareVersion').mockReturnValue(build);
  return createRadioSession({ descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR, pipe, radio });
}

describe('radioWriteIdentityFromSession', () => {
  it('shows the RadioFoundry build and its notes', () => {
    const build = {
      git: '1a2b3c4d-dirty',
      gitTime: 1795365603,
      source: 'fork',
      features: [],
      off: [],
    };
    const identity = radioWriteIdentityFromSession(foundrySession(build));
    const summary = summariseRadioFoundryBuild(build);
    expect(identity.firmware).toBe(summary.label);
    expect(identity.firmwareNotes).toEqual(summary.notes);
  });

  it('says when the radio reported no version', () => {
    const identity = radioWriteIdentityFromSession(foundrySession(null));
    expect(identity.firmware).toBe('RadioFoundry (version not reported)');
    expect(identity.firmwareNotes).toHaveLength(1);
  });

  it('leaves other radios unchanged', () => {
    const session = createRadioSession({
      descriptor: { modelIds: ['X'], label: 'X' } as unknown as RadioDescriptor,
      pipe,
      radio: {} as CloneImageRadio,
    });
    expect(radioWriteIdentityFromSession(session)).toEqual({ model: 'X' });
  });
});
