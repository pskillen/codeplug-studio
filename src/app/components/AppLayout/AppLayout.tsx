import { useEffect } from 'react';
import { Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconBug, IconSettings } from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  BottomTabBar,
  ContextualStrip,
  DesignSystemV2Provider,
} from '../v2/index.ts';
import type { BottomTabItem } from '../v2/BottomTabBar.tsx';
import BuildFooter from '../BuildFooter/BuildFooter.tsx';
import BuildSwitcher from '../builds/BuildSwitcher/BuildSwitcher.tsx';
import CookieConsentBanner from '../CookieConsentBanner/CookieConsentBanner.tsx';
import DriveRefreshProvider from '../ProjectInterchangeBar/DriveRefreshProvider.tsx';
import RefreshFromDriveBanner from '../ProjectInterchangeBar/RefreshFromDriveBanner.tsx';
import SidebarDriveControls from '../SidebarDriveControls/SidebarDriveControls.tsx';
import { usePageAnalytics } from '../../hooks/usePageAnalytics.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { handleExternalLinkClick } from '../../lib/openExternalUrl.ts';
import {
  activeContextualStripLabel,
  resolveContextualStripItems,
} from '../../nav/contextualStripItems.ts';
import { navActive } from '../../nav/navActive.ts';
import { primaryNavItems } from '../../nav/primaryNavItems.ts';
import { useBuildContextualStrip } from '../../nav/useBuildContextualStrip.ts';
import { isBuildDetailPath } from '../../routes/builds/nav.ts';
import { useProjects } from '../../state/useProjects.ts';
import shellClasses from '../v2/AppShell.module.css';
import classes from './AppLayout.module.css';

/** Mantine `sm` — single breakpoint for AppShell tabs ↔ BottomTabBar. */
const DESKTOP_NAV_QUERY = '(min-width: 48em)';

export default function AppLayout() {
  usePageAnalytics();

  useEffect(() => {
    window.addEventListener('click', handleExternalLinkClick, true);
    return () => {
      window.removeEventListener('click', handleExternalLinkClick, true);
    };
  }, []);

  const isDesktopNav = useMediaQuery(DESKTOP_NAV_QUERY);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeProjectId, activeProject } = useProjects();
  const hasActiveProject = activeProjectId != null;

  const visibleTabs = primaryNavItems.filter(
    (item) => !item.requiresProject || hasActiveProject,
  );
  const tabLabels = visibleTabs.map((item) => item.label);
  const activePrimary =
    visibleTabs.find((item) => navActive(location.pathname, item.to)) ?? null;

  const staticStrip = resolveContextualStripItems(location.pathname);
  const buildStrip = useBuildContextualStrip(location.pathname);
  const stripItems = buildStrip ?? staticStrip;
  const stripActive = stripItems
    ? activeContextualStripLabel(location.pathname, stripItems)
    : null;
  const showBuildSwitcher = isBuildDetailPath(location.pathname);

  const bottomItems: BottomTabItem[] = visibleTabs.map((item) => {
    const Icon = item.icon;
    return {
      id: item.label,
      label: item.label,
      icon: <Icon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
    };
  });

  function goToTab(label: string) {
    const item = primaryNavItems.find((t) => t.label === label);
    if (!item) return;
    if (item.requiresProject && !hasActiveProject) return;
    navigate(item.to);
  }

  function goToStrip(label: string) {
    const item = stripItems?.find((s) => s.label === label);
    if (item) navigate(item.to);
  }

  const projectName = hasActiveProject
    ? (activeProject?.name ?? 'Untitled project')
    : 'Projects';

  const overflowAvatar = (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <button type="button" className={shellClasses.avatar} aria-label="More" />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          to="/settings"
          leftSection={<IconSettings size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        >
          Settings
        </Menu.Item>
        <Menu.Item
          component={Link}
          to="/debug"
          leftSection={<IconBug size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        >
          Debug
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  return (
    <DriveRefreshProvider>
      <div className={classes.root}>
        <DesignSystemV2Provider>
          <AppShell
            tabs={tabLabels}
            activeTab={activePrimary?.label}
            onTabChange={goToTab}
            showTabs={isDesktopNav !== false}
            projectName={projectName}
            onProjectClick={() => navigate('/')}
            rightExtra={
              hasActiveProject ? <SidebarDriveControls variant="header" /> : undefined
            }
            avatar={overflowAvatar}
          />
          {stripItems && stripItems.length > 0 ? (
            <ContextualStrip
              items={stripItems.map((i) => i.label)}
              active={stripActive ?? undefined}
              onChange={goToStrip}
              leading={showBuildSwitcher ? <BuildSwitcher compact /> : undefined}
            />
          ) : null}
        </DesignSystemV2Provider>

        <main className={classes.main}>
          <CookieConsentBanner />
          <RefreshFromDriveBanner />
          <Outlet />
          <BuildFooter />
        </main>

        {isDesktopNav === false ? (
          <DesignSystemV2Provider>
            <BottomTabBar
              items={bottomItems}
              activeId={activePrimary?.label}
              onChange={goToTab}
            />
          </DesignSystemV2Provider>
        ) : null}
      </div>
    </DriveRefreshProvider>
  );
}
