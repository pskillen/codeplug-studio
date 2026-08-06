import { Menu } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';
import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from '../v2/Button.tsx';
import StatusDot from '../v2/StatusDot.tsx';
import classes from './ProjectManageCard.module.css';

export interface ProjectManageCardProps {
  project: ProjectMeta;
  isActive: boolean;
  statsLabel?: string | null;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function formatLastOpened(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime();
  if (ms < 60_000) return 'Last opened just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Last opened ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Last opened ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `Last opened ${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `Last opened ${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function syncLabel(project: ProjectMeta): { tone: 'success' | 'neutral'; label: string } {
  if (portableSyncedAt(project)) {
    return { tone: 'success', label: 'Synced to Drive' };
  }
  return { tone: 'neutral', label: 'Local only' };
}

export default function ProjectManageCard({
  project,
  isActive,
  statsLabel,
  onOpen,
  onRename,
  onDelete,
}: ProjectManageCardProps) {
  const sync = syncLabel(project);

  return (
    <article className={classes.card}>
      <div className={classes.cardHeader}>
        <div className={classes.cardName}>{project.name}</div>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <button
              type="button"
              className={classes.menuButton}
              aria-label={`Actions for ${project.name}`}
            >
              <IconDotsVertical size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onRename}>Rename</Menu.Item>
            <Menu.Item color="red" onClick={onDelete}>
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
      <div className={classes.cardSub}>{formatLastOpened(project.updatedAt)}</div>
      {statsLabel ? <div className={classes.cardStats}>{statsLabel}</div> : null}
      <StatusDot tone={sync.tone} label={sync.label} />
      <div className={classes.cardActions}>
        <Button
          size="sm"
          variant={isActive ? 'secondary' : 'primary'}
          onClick={onOpen}
          disabled={isActive}
        >
          {isActive ? 'Current project' : 'Open project'}
        </Button>
      </div>
    </article>
  );
}
