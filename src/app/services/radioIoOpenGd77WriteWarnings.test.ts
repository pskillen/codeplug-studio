import { describe, expect, it } from 'vitest';
import { OPENGD77_DM1701_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/dm1701/descriptor.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import { OPENGD77_ZERO_DIRTY_SECTORS_MESSAGE } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { openGd77WriteWarnings } from './radioIoSession.ts';

describe('openGd77WriteWarnings', () => {
  it('zero dirty sectors notice is a note', () => {
    const radio = new OpenGd77Protocol();
    const session: RadioSession = {
      descriptor: OPENGD77_DM1701_DESCRIPTOR,
      pipe: {} as RadioSession['pipe'],
      radio,
    };
    const warnings = openGd77WriteWarnings(session);
    expect(warnings).toEqual([
      { kind: 'general', severity: 'info', message: OPENGD77_ZERO_DIRTY_SECTORS_MESSAGE },
    ]);
  });
});
