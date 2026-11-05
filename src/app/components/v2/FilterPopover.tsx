import { Drawer, Popover } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { ReactNode } from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { DSV2_SCOPE_SELECTOR } from '../../theme-v2.ts';
import Button from './Button.tsx';
import Pill from './Pill.tsx';
import SegmentedControl from './SegmentedControl.tsx';
import classes from './FilterPopover.module.css';

export interface FilterPopoverTab<T extends string = string> {
  value: T;
  label: string;
}

export interface FilterPopoverProps<T extends string = string> {
  /** Trigger button label — e.g. "Filters". */
  triggerLabel: string;
  opened: boolean;
  onOpenChange: (opened: boolean) => void;
  /** Number of currently-applied filters, shown as a badge on the trigger. */
  activeCount?: number;
  tabs: FilterPopoverTab<T>[];
  activeTab: T;
  onTabChange: (value: T) => void;
  /** Active tab's chip-wall content. */
  children: ReactNode;
  /** Always-visible content below the tab panel, regardless of active tab. */
  footer?: ReactNode;
  onDone?: () => void;
}

/**
 * Anchored floating filter panel — tab strip over a single chip wall, plus an
 * always-visible footer. A floating popover on desktop; a bottom sheet on mobile, so it can't be
 * clipped by a scroll or swipe container.
 */
export default function FilterPopover<T extends string = string>({
  triggerLabel,
  opened,
  onOpenChange,
  activeCount,
  tabs,
  activeTab,
  onTabChange,
  children,
  footer,
  onDone,
}: FilterPopoverProps<T>) {
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });

  const trigger = (
    <button
      type="button"
      className={[classes.trigger, opened || activeCount ? classes.triggerActive : '']
        .filter(Boolean)
        .join(' ')}
      onClick={() => onOpenChange(!opened)}
      aria-expanded={opened}
    >
      {triggerLabel}
      {activeCount ? (
        <Pill tone="accentSolid" className={classes.triggerBadge}>
          {activeCount}
        </Pill>
      ) : null}
    </button>
  );

  const panel = (
    <div className={classes.panel}>
      <SegmentedControl options={tabs} value={activeTab} onChange={onTabChange} size="md" />
      <div className={classes.tabPanel}>{children}</div>
      {footer ? (
        <>
          <div className={classes.divider} />
          <div className={classes.footer}>{footer}</div>
        </>
      ) : null}
      <div className={classes.doneRow}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            onDone?.();
            onOpenChange(false);
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          opened={opened}
          onClose={() => onOpenChange(false)}
          position="bottom"
          size="auto"
          title={triggerLabel}
          withinPortal
          portalProps={{ target: DSV2_SCOPE_SELECTOR }}
          zIndex={400}
          classNames={{
            content: classes.sheet,
            header: classes.sheetHeader,
            title: classes.sheetTitle,
            body: classes.sheetBody,
          }}
        >
          {panel}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      opened={opened}
      onClose={() => onOpenChange(false)}
      position="bottom-start"
      offset={8}
      withinPortal
      portalProps={{ target: DSV2_SCOPE_SELECTOR }}
    >
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown className={classes.dropdown} p={0}>
        {panel}
      </Popover.Dropdown>
    </Popover>
  );
}
