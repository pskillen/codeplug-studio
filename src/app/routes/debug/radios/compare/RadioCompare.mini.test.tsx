import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DebugArchive } from '../captureArchive.ts';
import { radioDebugDescriptors } from '../descriptors.ts';
import { RadioCompare } from './RadioCompare.tsx';

const descriptor = radioDebugDescriptors.find((d) => d.slug === 'uv-5r-mini')!;

const mini = (clone: Uint8Array) =>
  ({
    manifest: { radioModelId: 'UV-5R Mini', capturedAt: '2026-01-01', regions: [] },
    regions: { clone },
    sidecars: {},
    source: 'file',
  }) as unknown as DebugArchive;

const view = (a: Uint8Array, b: Uint8Array) =>
  render(
    <MantineProvider>
      <RadioCompare descriptor={descriptor} a={mini(a)} b={mini(b)} />
    </MantineProvider>,
  );

describe('UV-5R Mini on the shared compare', () => {
  it('stays green when only a log sector differs, and reports the skipped sectors', () => {
    const a = new Uint8Array(0x10000);
    const b = a.slice();
    b[0x8800] = 1; // inside a log sector the radio owns, outside the VFO frame
    view(a, b);
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.getByText(/Not compared:/)).toBeInTheDocument();
    expect(screen.queryByText('A and B differ')).not.toBeInTheDocument();
  });

  it('reports a changed VFO frame without deciding the verdict', () => {
    const a = new Uint8Array(0x10000);
    const b = a.slice();
    b[0x8005] = 1;
    view(a, b);
    expect(screen.getByText('Identical')).toBeInTheDocument();
    expect(screen.getByText(/Reported only, differ/)).toBeInTheDocument();
  });

  it('is amber when a compared span differs, and still lists the decoded changes', () => {
    const a = new Uint8Array(0x10000);
    const b = a.slice();
    b[0x0004] = 7;
    view(a, b);
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
    expect(screen.getByText('Decoded changes')).toBeInTheDocument();
  });
});
