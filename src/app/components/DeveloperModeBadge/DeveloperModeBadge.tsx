import { IconCode, IconX } from '@tabler/icons-react';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';
import classes from './DeveloperModeBadge.module.css';

/**
 * Persistent "Developer mode" chip in the top bar while developer mode is on for this device (#1650), with a one-tap
 * way to turn it off. Renders nothing while it is off.
 */
export default function DeveloperModeBadge() {
  const [on, setOn] = useDeveloperMode();
  if (!on) return null;
  return (
    <span className={classes.root} data-testid="developer-mode-badge">
      <IconCode size={14} stroke={1.75} aria-hidden />
      <span className={classes.label}>Developer mode</span>
      <button
        type="button"
        className={classes.off}
        aria-label="Turn off developer mode"
        title="Turn off developer mode"
        onClick={() => setOn(false)}
      >
        <IconX size={14} stroke={1.75} aria-hidden />
      </button>
    </span>
  );
}
