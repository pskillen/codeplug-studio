import { emptyLibrary } from '@core/domain/factories.ts';
import type { Library } from '@core/models/library.ts';
import type { ModePanelContext } from './types.ts';

export function testModePanelContext(over: Partial<ModePanelContext> = {}): ModePanelContext {
  return {
    library: emptyLibrary(),
    savedChannel: null,
    rxFrequency: null,
    txFrequency: null,
    compact: false,
    ...over,
  };
}

export function testModePanelContextWithLibrary(
  library: Library,
  over: Partial<ModePanelContext> = {},
): ModePanelContext {
  return testModePanelContext({ library, ...over });
}