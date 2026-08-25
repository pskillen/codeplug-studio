import classes from './SectionNav.module.css';

export type SectionNavOrientation = 'vertical' | 'horizontal';

/**
 * A nav entry: a bare string (matches/emits itself, today's behaviour) or an
 * `{id, label}` pair (matches/emits `id`, displays `label`) — for callers whose
 * section identity (anchor id) differs from its display text.
 */
export type SectionNavItem = string | { id: string; label: string };

export interface SectionNavProps {
  items: readonly SectionNavItem[];
  /** Matches item id (object form) or label (string form). */
  active?: string;
  /** Emits id for object items, label for string items. */
  onChange?: (item: string) => void;
  orientation?: SectionNavOrientation;
  className?: string;
}

function itemKey(item: SectionNavItem): string {
  return typeof item === 'string' ? item : item.id;
}

function itemLabel(item: SectionNavItem): string {
  return typeof item === 'string' ? item : item.label;
}

/**
 * In-page section nav (e.g. channel editor sections). Vertical rail or
 * horizontal pill strip.
 */
export default function SectionNav({
  items,
  active,
  onChange,
  orientation = 'vertical',
  className,
}: SectionNavProps) {
  const vertical = orientation === 'vertical';

  return (
    <nav
      className={[classes.root, vertical ? classes.vertical : classes.horizontal, className]
        .filter(Boolean)
        .join(' ')}
      aria-label="Section"
    >
      {items.map((item) => {
        const key = itemKey(item);
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            className={[classes.item, isActive ? classes.active : ''].filter(Boolean).join(' ')}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onChange?.(key)}
          >
            {itemLabel(item)}
          </button>
        );
      })}
    </nav>
  );
}
