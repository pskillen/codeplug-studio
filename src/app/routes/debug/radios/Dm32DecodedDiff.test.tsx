import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('@integrations/radio-io/radios/dm32uv/debugCompare.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@integrations/radio-io/radios/dm32uv/debugCompare.ts')>();
  return {
    ...actual,
    compareDm32Evidence: vi.fn((a, b) => [
      ...actual.compareDm32Evidence(a, b),
      { field: 'Calibration / uhfBand / lowHz', left: null, right: 4e8, status: 'Unavailable' },
    ]),
  };
});
import { Dm32DecodedDiff } from './Dm32DecodedDiff.tsx';
import { exampleArchive } from './debugReadHistory.fixture.ts';

it('shows missing evidence as unavailable and explains sparse comparison', () => {
  const archive = exampleArchive();
  render(
    <MantineProvider>
      <Dm32DecodedDiff first={archive} second={archive} />
    </MantineProvider>,
  );
  expect(screen.getByText(/Calibration: Unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/Factory: Unavailable/)).toBeInTheDocument();
  expect(screen.getByText(/different partitions/)).toBeInTheDocument();
});

it('shows an invalid decode as Unavailable and never as null', () => {
  const archive = exampleArchive();
  render(
    <MantineProvider>
      <Dm32DecodedDiff first={archive} second={archive} />
    </MantineProvider>,
  );
  expect(
    screen.getByText('Calibration / uhfBand / lowHz: Unavailable · Unavailable → 400000000'),
  ).toBeInTheDocument();
});
