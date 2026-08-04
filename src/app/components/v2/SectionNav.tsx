import classes from './SectionNav.module.css';

export type SectionNavOrientation = 'vertical' | 'horizontal';

export interface SectionNavProps {
  items: readonly string[];
  active?: string;
  onChange?: (item: string) => void;
  orientation?: SectionNavOrientation;
  className?: string;
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
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            className={[classes.item, isActive ? classes.active : ''].filter(Boolean).join(' ')}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onChange?.(item)}
          >
            {item}
          </button>
        );
      })}
    </nav>
  );
}
