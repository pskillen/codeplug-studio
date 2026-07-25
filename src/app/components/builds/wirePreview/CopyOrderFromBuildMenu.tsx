import { Button, Menu } from '@mantine/core';
import { IconArrowsRightLeft } from '@tabler/icons-react';
import { useMemo } from 'react';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { ICON_STROKE } from '../../../lib/iconSizes.ts';

export interface CopyOrderFromBuildStats {
  matchedCount: number;
  unmatchedCount: number;
}

export interface CopyOrderFromBuildMenuProps {
  /** Eligible source builds (caller excludes current build). */
  builds: RadioBuild[];
  disabled?: boolean;
  confirmMessage: (source: RadioBuild, stats: CopyOrderFromBuildStats) => string;
  onCopy: (sourceBuildId: string) => void;
  /** Resolve match stats for confirm copy (caller projects order). */
  resolveStats: (sourceBuildId: string) => CopyOrderFromBuildStats | null;
}

function buildMenuGroups(builds: RadioBuild[]) {
  const byGroup = new Map<string, RadioBuild[]>();

  for (const build of builds) {
    const group = radioTargetFor(build.radioTargetId)?.group ?? 'Other';
    const items = byGroup.get(group) ?? [];
    items.push(build);
    byGroup.set(group, items);
  }

  for (const items of byGroup.values()) {
    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  return [...byGroup.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export default function CopyOrderFromBuildMenu({
  builds,
  disabled = false,
  confirmMessage,
  onCopy,
  resolveStats,
}: CopyOrderFromBuildMenuProps) {
  const groups = useMemo(() => buildMenuGroups(builds), [builds]);
  const menuDisabled = disabled || builds.length === 0;

  const requestCopy = (source: RadioBuild) => {
    const stats = resolveStats(source.id);
    if (!stats) return;
    if (!window.confirm(confirmMessage(source, stats))) return;
    onCopy(source.id);
  };

  return (
    <Menu shadow="md" width={300} position="bottom-start">
      <Menu.Target>
        <Button
          type="button"
          variant="default"
          size="compact-sm"
          leftSection={<IconArrowsRightLeft size={14} stroke={ICON_STROKE} />}
          disabled={menuDisabled}
        >
          Copy order from…
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Source build</Menu.Label>
        {groups.map(([group, items], groupIndex) => (
          <div key={group}>
            {groupIndex > 0 ? <Menu.Divider /> : null}
            <Menu.Label>{group}</Menu.Label>
            {items.map((build) => (
              <Menu.Item key={build.id} onClick={() => requestCopy(build)}>
                {build.name}
              </Menu.Item>
            ))}
          </div>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
