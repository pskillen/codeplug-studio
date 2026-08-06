import { IconSearch, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from './Button.tsx';
import classes from './AddMembersScreen.module.css';

export interface AddMembersScreenSection {
  id: string;
  label: string;
  count?: number;
}

export interface AddMembersScreenSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface AddMembersScreenProps {
  open: boolean;
  title: ReactNode;
  onCancel: () => void;
  /** Tabs render only when there's more than one section (e.g. Zones: Channels + Zones). */
  sections?: AddMembersScreenSection[];
  activeSectionId?: string;
  onSectionChange?: (id: string) => void;
  search?: AddMembersScreenSearchConfig;
  totalStaged: number;
  onCommit: () => void;
  /** `MembershipPoolRow`s for the active section. */
  children?: ReactNode;
  className?: string;
}

/**
 * Full-screen picker takeover — the pool ("B") side of the Membership family.
 * A members-first list (MembershipPanel) triggers this via `onAdd`; staged
 * selections commit back to the member list via `onCommit`.
 */
export default function AddMembersScreen({
  open,
  title,
  onCancel,
  sections = [],
  activeSectionId,
  onSectionChange,
  search,
  totalStaged,
  onCommit,
  children,
  className,
}: AddMembersScreenProps) {
  if (!open) return null;

  return (
    <div
      className={[classes.root, className].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
    >
      <div className={classes.header}>
        <div className={classes.title}>{title}</div>
        <button type="button" className={classes.close} aria-label="Close" onClick={onCancel}>
          <IconX size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
        </button>
      </div>

      {sections.length > 1 ? (
        <div className={classes.tabs} role="tablist">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={section.id === activeSectionId}
              className={[classes.tab, section.id === activeSectionId ? classes.tabActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSectionChange?.(section.id)}
            >
              {section.label}
              {section.count != null ? (
                <span className={classes.tabCount}>{section.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {search ? (
        <div className={classes.search}>
          <IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />
          <input
            type="text"
            value={search.value}
            onChange={(event) => search.onChange(event.currentTarget.value)}
            placeholder={search.placeholder ?? 'Find…'}
            aria-label="Find candidates"
            className={classes.searchInput}
          />
        </div>
      ) : null}

      <div className={classes.body}>{children}</div>

      <div className={classes.footer}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onCommit} disabled={totalStaged === 0}>
          Add selected ({totalStaged})
        </Button>
      </div>
    </div>
  );
}
