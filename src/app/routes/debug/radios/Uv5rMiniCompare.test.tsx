import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { Uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';
import { hashUv5rMiniDebugSpans } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { Uv5rMiniCompare } from './Uv5rMiniCompare.tsx';

it('compares clone windows and reports special channel slots', () => {
  const store = new Uv5rMiniDebugReadStore();
  const a = new Uint8Array(0x10000);
  const b = a.slice();
  b[0x8005] = 1;
  b[0x8800] = 1;
  for (const decoded of [a, b])
    store.add({
      decoded,
      raw: decoded,
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      spans: hashUv5rMiniDebugSpans(decoded),
    });
  render(
    <MantineProvider>
      <Uv5rMiniCompare reads={store.getSnapshot().reads} />
    </MantineProvider>,
  );
  expect(screen.getByText('Identical compared spans')).toBeInTheDocument();
  expect(screen.getByText(/VFO frame.*1 bytes differ/)).toBeInTheDocument();
  expect(screen.getByText(/Slot 248/)).toBeInTheDocument();
});
