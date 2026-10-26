import { describe, expect, it, vi } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

// Contact addresses are fixed by the codec, so a vital address can only be reached by forging
// the packed staging chunks. This pins that the writer still routes through the hard deny.
vi.mock('./digitalContactCodec.ts', () => ({
  packAtD890DigitalContacts: () => ({
    stagingChunks: [{ address: 0x04f8_0000, data: new Uint8Array(0x10).fill(0x11) }],
  }),
}));

const { uploadAtD890DigitalContacts } = await import('./digitalContactWrite.ts');

describe('uploadAtD890DigitalContacts hard deny', () => {
  it('refuses a staged chunk in the LocalInfo unit before any write frame', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
    pipe.autoAckWrites = true;
    const run = () => uploadAtD890DigitalContacts(pipe, []);
    await expect(run()).rejects.toThrow(RadioProtocolError);
    await expect(run()).rejects.toThrow(/LocalInfo \/ calibration/);
    expect(pipe.writes.filter((w) => w[0] === 0x57)).toHaveLength(0);
  });
});
