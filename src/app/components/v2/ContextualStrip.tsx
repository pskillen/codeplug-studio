import classes from './ContextualStrip.module.css';

export interface ContextualStripProps {
  items: readonly string[];
  active?: string;
  onChange?: (item: string) => void;
  className?: string;
}

/**
 * Section sub-view pill strip, typically directly under `AppShell`.
 */
export default function ContextualStrip({
  items,
  active,
  onChange,
  className,
}: ContextualStripProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[classes.item, isActive ? classes.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange?.(item)}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
