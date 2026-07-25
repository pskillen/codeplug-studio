import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EgressPathwayPill, EgressPathwayPills, pathwayPillTone } from './EgressPathwayPills.tsx';
import type { CompatibleEgress } from '@core/radio-targets/index.ts';

function entry(formatId: string, label: string): CompatibleEgress {
  return {
    formatId,
    profileId: `${formatId}-profile`,
    kind: formatId === 'radio-io' ? 'web-serial' : 'cps-file',
    label,
  };
}

describe('pathwayPillTone', () => {
  it('classifies serial, NeonPlug, DM32 warning, and other CSV tiers', () => {
    expect(pathwayPillTone('radio-io')).toBe('happiest');
    expect(pathwayPillTone('neonplug')).toBe('neutral');
    expect(pathwayPillTone('dm32')).toBe('warning');
    expect(pathwayPillTone('chirp')).toBe('csv');
    expect(pathwayPillTone('opengd77')).toBe('csv');
    expect(pathwayPillTone('anytone')).toBe('csv');
  });
});

describe('EgressPathwayPills', () => {
  it('renders a pill per pathway label', () => {
    render(
      <MantineProvider>
        <EgressPathwayPills
          egress={[
            entry('radio-io', 'Web Serial'),
            entry('neonplug', 'NeonPlug'),
            entry('chirp', 'CHIRP CSV'),
          ]}
        />
      </MantineProvider>,
    );
    expect(screen.getByText('Web Serial')).toBeInTheDocument();
    expect(screen.getByText('NeonPlug')).toBeInTheDocument();
    expect(screen.getByText('CHIRP CSV')).toBeInTheDocument();
  });

  it('uses warning styling only for DM32 CSV', () => {
    const { container: dm32 } = render(
      <MantineProvider>
        <EgressPathwayPill entry={entry('dm32', 'DM32 CSV')} />
      </MantineProvider>,
    );
    expect(dm32.querySelector('[data-variant="outline"]')).toBeInTheDocument();

    const { container: chirp } = render(
      <MantineProvider>
        <EgressPathwayPill entry={entry('chirp', 'CHIRP CSV')} />
      </MantineProvider>,
    );
    expect(chirp.querySelector('[data-variant="outline"]')).not.toBeInTheDocument();
    expect(chirp.querySelector('[data-variant="light"]')).toBeInTheDocument();
  });

  it('shows an icon on every pathway tier', () => {
    for (const formatId of ['radio-io', 'neonplug', 'chirp', 'dm32'] as const) {
      const { container } = render(
        <MantineProvider>
          <EgressPathwayPill entry={entry(formatId, formatId)} />
        </MantineProvider>,
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    }
  });
});
