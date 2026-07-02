import { describe, expect, it } from 'vitest';
import { readTextFile } from './readTextFile.ts';

describe('readTextFile', () => {
  it('reads UTF-8 text from a File', async () => {
    const file = new File(['project:\n  name: Test\n'], 'test.yaml', { type: 'application/yaml' });
    await expect(readTextFile(file)).resolves.toBe('project:\n  name: Test\n');
  });

  it('rejects files over the size limit', async () => {
    const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.yaml');
    await expect(readTextFile(large)).rejects.toThrow(/too large/i);
  });
});
