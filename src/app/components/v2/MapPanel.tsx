import { IconAdjustments } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './MapPanel.module.css';

export interface MapPanelProps {
  title?: string;
  /** Map body height in px (design system default 200). */
  height?: number;
  /** Live map content (CodeplugMap, MapLocationPicker, MapPairPlot). */
  children?: ReactNode;
  /** Overlay caption inside the hatch when no children (default `[ map ]`). */
  caption?: ReactNode;
  /** Optional legend row under the map. */
  legend?: ReactNode;
  /** When true, gear control uses accent border (settings popover open). */
  gearActive?: boolean;
  onSettingsClick?: () => void;
  className?: string;
  /** Accessible label for the map region (placeholder or live). */
  mapLabel?: string;
}

/**
 * Map chrome: optional title + settings gear, map body, optional legend.
 * Without children, renders a diagonal-hatch placeholder; with children, hosts live maps.
 */
export default function MapPanel({
  title,
  height = 200,
  children,
  caption = '[ map ]',
  legend,
  gearActive = false,
  onSettingsClick,
  className,
  mapLabel,
}: MapPanelProps) {
  const showHeader = Boolean(title || onSettingsClick || gearActive);
  const mapStyle: CSSProperties = { height };
  const hasLiveMap = children != null;
  const resolvedMapLabel = mapLabel ?? (hasLiveMap ? 'Map' : 'Map placeholder');

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      {showHeader ? (
        <div className={classes.header}>
          {title ? <div className={classes.title}>{title}</div> : null}
          {onSettingsClick || gearActive ? (
            <button
              type="button"
              className={[classes.gear, gearActive ? classes.gearActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-label="Map settings"
              aria-pressed={gearActive || undefined}
              onClick={onSettingsClick}
            >
              <IconAdjustments size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={[classes.map, hasLiveMap ? classes.mapLive : ''].filter(Boolean).join(' ')}
        role={hasLiveMap ? undefined : 'img'}
        aria-label={resolvedMapLabel}
        style={mapStyle}
      >
        {hasLiveMap ? (
          children
        ) : caption ? (
          <span className={classes.caption}>{caption}</span>
        ) : null}
      </div>
      {legend ? <div className={classes.legend}>{legend}</div> : null}
    </div>
  );
}
