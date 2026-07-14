import { useState } from 'react';
import SoftWarning from '../ui/SoftWarning.tsx';

const DISMISS_KEY = 'codeplug-studio:browser-only-warning-dismissed';

function sessionDismissed(projectId: string): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as string[];
    return ids.includes(projectId);
  } catch {
    return false;
  }
}

function dismissForSession(projectId: string): void {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    if (!ids.includes(projectId)) {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids, projectId]));
    }
  } catch {
    // Ignore storage errors.
  }
}

export interface BrowserOnlyWarningProps {
  projectId: string;
}

export default function BrowserOnlyWarning({ projectId }: BrowserOnlyWarningProps) {
  const [dismissed, setDismissed] = useState(() => sessionDismissed(projectId));

  if (dismissed) {
    return null;
  }

  return (
    <SoftWarning
      title="Browser-only backup"
      onDismiss={() => {
        dismissForSession(projectId);
        setDismissed(true);
      }}
    >
      This project is only stored in this browser — connect Google Drive or export YAML to back up.
    </SoftWarning>
  );
}
