import { ActionIcon } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './MapPanel.module.css';

export interface MapPanelProps {
  title?: string;
  onSettingsClick?: () => void;
  /** Optional legend row under the placeholder map. */
  legend?: ReactNode;
  className?: string;
  /** Accessible label for the placeholder map region. */
  mapLabel?: string;
}

/**
 * Map chrome with a diagonal-hatch placeholder. Real CodeplugMap wiring is #925.
 */
export default function MapPanel({
  title,
  onSettingsClick,
  legend,
  className,
  mapLabel = 'Map placeholder',
}: MapPanelProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      {(title || onSettingsClick) && (
        <div className={classes.header}>
          {title ? <div className={classes.title}>{title}</div> : <span />}
          {onSettingsClick ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Map settings"
              onClick={onSettingsClick}
            >
              <IconSettings size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            </ActionIcon>
          ) : null}
        </div>
      )}
      <div className={classes.map} role="img" aria-label={mapLabel} />
      {legend ? <div className={classes.legend}>{legend}</div> : null}
    </div>
  );
}
