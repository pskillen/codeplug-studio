import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DebugArchive } from '../captureArchive.ts';
import { dm32Capture, dm32Page } from '../dm32Archive.fixture.ts';
import { archiveDm32Capture } from '../dm32Capture.ts';
import { radioDebugDescriptors } from '../descriptors.ts';
import { RadioCompare } from './RadioCompare.tsx';

const descriptor = radioDebugDescriptors.find((d) => d.slug === 'dm-32uv')!;

async function withPassword(password: string) {
  const settings = dm32Page(0x04);
  settings.set(new TextEncoder().encode(password), 0x431);
  return archiveDm32Capture(
    dm32Capture({
      blocks: new Map([
        [0x1000, settings],
        [0x2000, dm32Page(0x12)],
      ]),
    }),
  );
}

const view = (a: DebugArchive, b: DebugArchive) => (
  <MantineProvider>
    <RadioCompare descriptor={descriptor} a={a} b={b} />
  </MantineProvider>
);
const hex = () => screen.getByRole('group', { name: 'Hex diff' }).textContent ?? '';

describe('RadioCompare password masking', () => {
  it('marks a changed password as changed while hidden, and hides it again when the pair changes', async () => {
    const a = await withPassword('1234');
    const b = await withPassword('5678');
    const view1 = render(view(a, b));
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
    expect(hex()).toContain('••');
    expect(hex()).toContain('[masked bytes differ]');
    expect(hex()).not.toMatch(/31 32 33 34|35 36 37 38/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]!);
    expect(hex()).toMatch(/31 32 33 34/);
    expect(screen.getAllByRole('button', { name: 'Hide password' })).toHaveLength(2);
    // A different B: hidden again.
    view1.rerender(view(a, await withPassword('9999')));
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(2);
    expect(hex()).not.toMatch(/31 32 33 34/);
  });

  it('does not flag identical passwords', async () => {
    render(view(await withPassword('1234'), await withPassword('1234')));
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.queryByText('[masked bytes differ]')).not.toBeInTheDocument();
  });
});
