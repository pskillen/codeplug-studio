import { Drawer, Popover } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useMemo, type ReactNode } from 'react';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { DSV2_SCOPE_SELECTOR } from '../../theme-v2.ts';
import Button from '../v2/Button.tsx';
import switcherClasses from '../shell/QuickProjectSwitcher.module.css';

export interface QuickBuildSwitcherProps {
  opened: boolean;
  onClose: () => void;
  onOpen: () => void;
  mobile?: boolean;
  children: ReactNode;
  builds: RadioBuild[];
  activeBuildId: string;
  onSwitchBuild: (buildId: string) => void;
  onNewBuild: () => void;
}

function buildGroups(builds: RadioBuild[]) {
  const byGroup = new Map<string, RadioBuild[]>();
  for (const build of builds) {
    const group = radioTargetFor(build.radioTargetId)?.group ?? 'Other';
    const list = byGroup.get(group) ?? [];
    list.push(build);
    byGroup.set(group, list);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  return [...byGroup.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

function SwitcherPanel({
  mobile,
  builds,
  activeBuildId,
  onSwitchBuild,
  onNewBuild,
  onClose,
}: Omit<QuickBuildSwitcherProps, 'opened' | 'onOpen' | 'children'>) {
  const groups = useMemo(() => buildGroups(builds), [builds]);

  return (
    <>
      <div className={switcherClasses.header}>Switch build</div>
      {groups.map(([group, groupBuilds]) => (
        <div key={group}>
          <div className={switcherClasses.header}>{group}</div>
          {groupBuilds.map((build) => {
            const isCurrent = build.id === activeBuildId;
            const radioLabel = radioTargetFor(build.radioTargetId)?.label ?? build.radioTargetId;
            return (
              <button
                key={build.id}
                type="button"
                className={[
                  switcherClasses.row,
                  mobile ? switcherClasses.rowMobile : '',
                  isCurrent ? switcherClasses.rowCurrent : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  onSwitchBuild(build.id);
                  onClose();
                }}
              >
                <div className={switcherClasses.rowBody}>
                  <div className={switcherClasses.rowName}>{build.name}</div>
                  <div className={switcherClasses.rowSub}>{radioLabel}</div>
                </div>
                {isCurrent ? (
                  <IconCheck
                    size={ICON_SIZE_NAV}
                    stroke={ICON_STROKE}
                    className={switcherClasses.check}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
      <div className={switcherClasses.footer}>
        <Button variant="dashed" size="sm" onClick={onNewBuild}>
          + New build
        </Button>
      </div>
    </>
  );
}

/**
 * mk2 build switcher — project-picker visual with grouped radio families.
 */
export default function QuickBuildSwitcher({
  opened,
  onClose,
  onOpen,
  mobile = false,
  children,
  ...panelProps
}: QuickBuildSwitcherProps) {
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
          classNames={{ content: switcherClasses.sheet }}
          withinPortal
          portalProps={{ target: DSV2_SCOPE_SELECTOR }}
        >
          <div className={switcherClasses.sheetHandle} aria-hidden />
          {panel}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      opened={opened}
      onClose={onClose}
      position="bottom-start"
      withinPortal
      portalProps={{ target: DSV2_SCOPE_SELECTOR }}
    >
      <Popover.Target>
        <div onClick={onOpen}>{children}</div>
      </Popover.Target>
      <Popover.Dropdown className={switcherClasses.panel}>{panel}</Popover.Dropdown>
    </Popover>
  );
}
