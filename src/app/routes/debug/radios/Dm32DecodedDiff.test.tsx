import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
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
