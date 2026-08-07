import type { EgressPath } from '@core/models/egressPath.ts';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { pathwayPillTone } from './EgressPathwayPills.tsx';
import classes from './EgressPathwayCards.module.css';

function egressPathLabel(path: EgressPath): string {
  if (path.label?.trim()) return path.label.trim();
  const formatLabel = formatCatalogEntry(path.formatId as FormatId)?.label ?? path.formatId;
  const profile = traitProfileFor(path.profileId)?.label ?? path.profileId;
  return `${formatLabel} — ${profile}`;
}

function pathwayIconClass(formatId: string): string {
  const tone = pathwayPillTone(formatId);
  return classes[`icon_${tone}`];
}

export interface EgressPathwayCardsProps {
  egressPaths: EgressPath[];
  activeEgressId: string;
  onSelect: (egressId: string) => void;
}

/**
 * mk2 B5 pathway picker — card grid instead of a dropdown or segmented control.
 */
export default function EgressPathwayCards({
  egressPaths,
  activeEgressId,
  onSelect,
}: EgressPathwayCardsProps) {
  if (egressPaths.length <= 1) return null;

  return (
    <div className={classes.root}>
      <div className={classes.title}>Pathway</div>
      <div className={classes.grid}>
        {egressPaths.map((path) => {
          const active = path.id === activeEgressId;
          return (
            <button
              key={path.id}
              type="button"
              className={[classes.card, active ? classes.cardActive : ''].filter(Boolean).join(' ')}
              aria-pressed={active}
              onClick={() => onSelect(path.id)}
            >
              <div className={classes.cardHeader}>
                <span
                  className={[classes.icon, pathwayIconClass(path.formatId)].join(' ')}
                  aria-hidden
                />
                <span className={classes.cardTitle}>{egressPathLabel(path)}</span>
              </div>
              <span className={classes.cardDesc}>
                {path.formatId === 'radio-io' ? 'Web Serial' : 'CPS files'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
