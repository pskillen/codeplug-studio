import type { ReactNode } from 'react';

import { useDeveloperMode } from '../../../hooks/useDeveloperMode.ts';

/**
 * Renders its children only with developer mode on (#1670): internal detail, such as the UV-5R Mini's flash layout,
 * that an ordinary user never needs. Display only, and the flasher steps' one way to developer mode: it hands nothing
 * back, so no step, check or prepared image can depend on it.
 */
export default function DeveloperOnly({ children }: { children: ReactNode }) {
  const [on] = useDeveloperMode();
  return on ? <>{children}</> : null;
}
