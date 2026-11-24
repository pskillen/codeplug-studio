import type { EgressStep, EgressStepStatus } from '../../egress/EgressShell/EgressShell.tsx';

export const FILE_EXPORT_STEPS = ['choose', 'checks', 'download'] as const;
export type FileExportStep = (typeof FILE_EXPORT_STEPS)[number];

export const FILE_EXPORT_STEP_LABEL: Record<FileExportStep, string> = {
  choose: 'What to export',
  checks: 'Checks',
  download: 'Download',
};

function stepIndex(step: FileExportStep): number {
  return FILE_EXPORT_STEPS.indexOf(step);
}

function baseStatus(
  id: FileExportStep,
  current: FileExportStep,
  errorStep: FileExportStep | null,
): EgressStepStatus {
  if (errorStep && id === errorStep) return 'error';
  const idx = stepIndex(id);
  const cur = stepIndex(current);
  if (idx < cur) return 'done';
  if (idx === cur) return 'current';
  return 'pending';
}

export function fileExportSteps(
  current: FileExportStep,
  showChoose: boolean,
  errorStep: FileExportStep | null,
): EgressStep[] {
  return FILE_EXPORT_STEPS.map((id) => {
    if (id === 'choose' && !showChoose) {
      return { id, label: FILE_EXPORT_STEP_LABEL.choose, status: 'skipped' as const };
    }
    return { id, label: FILE_EXPORT_STEP_LABEL[id], status: baseStatus(id, current, errorStep) };
  });
}
