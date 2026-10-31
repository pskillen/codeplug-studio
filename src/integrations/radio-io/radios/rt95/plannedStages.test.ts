import { describe, expect, it } from 'vitest';
import { planRt95Stages } from './plannedStages.ts';

describe('RT95 planned stages', () => {
  it('settings-only Write plans read settings and touched-block upload weights', () => {
    const plan = planRt95Stages('write', {
      parts: { codeplug: false, contacts: false, settings: true, keps: false },
      prepared: {
        channels: [],
        organisation: {
          rt95SettingsOverrides: [{ fieldId: 'displayMode', value: 1 }],
        },
      },
    });
    expect(plan).toEqual([
      { label: 'Read settings', weight: 0x32a0 },
      { label: 'Upload', weight: 32 },
    ]);
  });

  it('codeplug Write still plans the full image upload', () => {
    const plan = planRt95Stages('write', {
      parts: { codeplug: true, contacts: false, settings: false, keps: false },
    });
    expect(plan[0]?.label).toBe('Pre-write read');
    expect(plan[1]?.label).toBe('Upload');
    expect(plan[1]?.weight).toBe(0x32a0);
  });
});
