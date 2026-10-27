import { describe, expect, it } from 'vitest';

import { AT_D890_FREQUENCY_RANGE_TOOL_ID, DANGER_ZONE_TOOLS } from './registry.ts';

describe('DANGER_ZONE_TOOLS', () => {
  it('has unique ids', () => {
    const ids = DANGER_ZONE_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists the D890 frequency range tool with its wizard route', () => {
    const tool = DANGER_ZONE_TOOLS.find((t) => t.id === AT_D890_FREQUENCY_RANGE_TOOL_ID);
    expect(tool).toBeDefined();
    expect(tool?.radios).toEqual(['anytone-at-d890uv', 'anytone-at-d890uv-mm9pdy']);
    expect(tool).not.toHaveProperty('prodDisabled');
    expect(tool?.minutes).toBe(10);
    expect(tool?.route).toBe('export/danger-zone/frequency-range');
  });
});
