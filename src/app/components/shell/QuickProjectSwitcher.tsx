import { Drawer, Popover } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useMemo, type ReactNode } from 'react';
import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from '../v2/Button.tsx';
import classes from './QuickProjectSwitcher.module.css';

export interface QuickProjectSwitcherProps {
  opened: boolean;
  onClose: () => void;
  onOpen: () => void;
  mobile?: boolean;
  /** Project chip (desktop: wrapped as Popover.Target). */
  children: ReactNode;
  projects: ProjectMeta[];
  activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void;
  onNewProject: () => void;
  onManageAll: () => void;
}

function formatOpenedAgo(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime();
  if (ms < 60_000) return 'Opened just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Opened ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Opened ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `Opened ${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `Opened ${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function SwitcherPanel({
  mobile,
  projects,
  activeProjectId,
  onSwitchProject,
  onNewProject,
  onManageAll,
  onClose,
}: Omit<QuickProjectSwitcherProps, 'opened' | 'onOpen' | 'children'>) {
  const recent = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
    [projects],
  );

  return (
    <>
      <div className={classes.header}>Switch project</div>
      <div>
        {recent.map((project) => {
          const isCurrent = project.projectId === activeProjectId;
          const synced = Boolean(portableSyncedAt(project));
          return (
            <button
              key={project.projectId}
              type="button"
              className={[
                classes.row,
                mobile ? classes.rowMobile : '',
                isCurrent ? classes.rowCurrent : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                onSwitchProject(project.projectId);
                onClose();
              }}
            >
              <div className={classes.rowBody}>
                <div className={classes.rowName}>{project.name}</div>
                <div className={classes.rowSub}>{formatOpenedAgo(project.updatedAt)}</div>
              </div>
              {isCurrent ? (
                <IconCheck size={ICON_SIZE_NAV} stroke={ICON_STROKE} className={classes.check} />
              ) : (
                <span
                  className={[classes.rowDot, synced ? classes.rowDotSynced : ''].join(' ')}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className={classes.footer}>
        <Button variant="dashed" size="sm" onClick={onNewProject}>
          + New project
        </Button>
        <Button variant="ghost" size="sm" onClick={onManageAll}>
          Manage all projects
        </Button>
      </div>
    </>
  );
}

/**
 * mk2 S3 quick project switcher — desktop popover or mobile bottom sheet.
 */
export default function QuickProjectSwitcher({
  opened,
  onClose,
  mobile = false,
  children,
  ...panelProps
}: QuickProjectSwitcherProps) {
  const panel = <SwitcherPanel {...panelProps} mobile={mobile} onClose={onClose} />;

  if (mobile) {
    return (
      <>
        {children}
        <Drawer
          opened={opened}
          onClose={onClose}
          position="bottom"
          size="auto"
          withCloseButton={false}
          padding={0}
          styles={{
            content: { background: 'transparent', boxShadow: 'none' },
            body: { padding: 0 },
          }}
        >
          <div className={classes.sheet}>
            <div className={classes.sheetHandle} aria-hidden />
            {panel}
          </div>
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      opened={opened}
      onClose={onClose}
      position="bottom-end"
      offset={8}
      width={320}
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown className={classes.panel} p={0}>
        {panel}
      </Popover.Dropdown>
    </Popover>
  );
}
