import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { formatPathwayBadge, profilePathwayBadge } from './preferNeonPlugPathwayBadges.tsx';

describe('preferNeonPlugPathwayBadges', () => {
  it('marks DM32 format and profiles toward NeonPlug', () => {
    render(
      <MantineProvider>
        {formatPathwayBadge('dm32')}
        {profilePathwayBadge('dm32-baofeng-dm32uv')}
      </MantineProvider>,
    );
    expect(screen.getAllByText('Prefer NeonPlug')).toHaveLength(2);
  });

  it('marks CHIRP UV-5R as still testing', () => {
    render(
      <MantineProvider>
        {profilePathwayBadge('chirp-uv5r')}
        {profilePathwayBadge('chirp-uv21')}
      </MantineProvider>,
    );
    expect(screen.getByText('Still testing')).toBeInTheDocument();
    expect(screen.queryByText('Prefer NeonPlug')).not.toBeInTheDocument();
  });

  it('marks NeonPlug as recommended', () => {
    render(
      <MantineProvider>
        {formatPathwayBadge('neonplug')}
        {profilePathwayBadge('neonplug-uv5rmini')}
      </MantineProvider>,
    );
    expect(screen.getAllByText('Recommended')).toHaveLength(2);
  });
});
