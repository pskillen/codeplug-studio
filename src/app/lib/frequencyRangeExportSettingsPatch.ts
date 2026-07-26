import type { BuildExportSettings, RadioBuild } from '@core/models/radioBuild.ts';
import {
  frequencyRangeHideToggleConfirmMessage,
  reconcileBuildAfterFrequencyHideToggle,
} from '@core/domain/channelEligibilityReconcile.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { BuildService } from '../state/buildService.ts';

export type FrequencyRangeExportPatchResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'ok'; build: RadioBuild };

/** Confirm + reconcile when the frequency-range hide toggle changes. */
export async function prepareBuildForFrequencyRangeExportPatch(
  build: RadioBuild,
  patch: Partial<BuildExportSettings>,
  options: {
    buildService: BuildService;
    loadLibrary: () => Promise<LibrarySlice | null>;
  },
): Promise<FrequencyRangeExportPatchResult> {
  if (patch.hideChannelsOutsideFrequencyRange === undefined) {
    return { status: 'ok', build: options.buildService.withExportSettings(build, patch) };
  }

  const nextHide = patch.hideChannelsOutsideFrequencyRange;
  const previousHide = build.exportSettings?.hideChannelsOutsideFrequencyRange !== false;

  if (nextHide === previousHide) {
    return { status: 'ok', build: options.buildService.withExportSettings(build, patch) };
  }

  if (!window.confirm(frequencyRangeHideToggleConfirmMessage())) {
    return { status: 'cancelled' };
  }

  const library = await options.loadLibrary();
  if (!library) {
    return { status: 'error', message: 'No active project.' };
  }

  return {
    status: 'ok',
    build: reconcileBuildAfterFrequencyHideToggle(build, library, nextHide).build,
  };
}
