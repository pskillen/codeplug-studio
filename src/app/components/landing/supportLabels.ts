import type { SupportState } from '@core/radio-targets/index.ts';

export const SUPPORT_STATE_LABEL: Record<SupportState, string> = {
  supported: 'Supported',
  partial: 'Partly supported',
  unsupported: 'Not supported',
  na: 'Not applicable',
};
