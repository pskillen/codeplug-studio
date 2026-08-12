import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { readEgressPathRow } from './egressPathRow.ts';

describe('readEgressPathRow', () => {
  it('strips radio-clone hydration bags', () => {
    const { egress } = newRadioBuildForProfile('proj-1', 'radio-io-uv5r-mini');
    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      capturedVia: 'web-serial',
      imageBase64: 'AQID',
      imageByteLength: 3,
    });
    const row = { ...egress, hydration };

    const result = readEgressPathRow(row);

    expect(result.hydration).toBeUndefined();
    expect(result.id).toBe(egress.id);
  });

  it('leaves egress rows without radio-clone hydration unchanged', () => {
    const { egress } = newRadioBuildForProfile('proj-1', 'radio-io-uv5r-mini');

    expect(readEgressPathRow(egress)).toEqual(egress);
  });
});
