import { describe, expect, it } from 'vitest';

import { AT_D890_FREQUENCY_RANGE_TOOL_ID, RADIO_TOOLS } from './registry.ts';

describe('RADIO_TOOLS', () => {
  it('has unique ids', () => {
    const ids = RADIO_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists the D890 frequency range tool, prod-disabled and not yet startable', () => {
    const tool = RADIO_TOOLS.find((t) => t.id === AT_D890_FREQUENCY_RANGE_TOOL_ID);
    expect(tool).toBeDefined();
    expect(tool?.radios).toEqual(['anytone-at-d890uv', 'anytone-at-d890uv-mm9pdy']);
    expect(tool?.prodDisabled).toBe(true);
    expect(tool?.minutes).toBe(10);
    expect(tool?.route).toBeUndefined();
  });
});
