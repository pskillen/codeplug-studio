import { useEffect, useState, type ReactNode } from 'react';
import { Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconBug, IconSettings } from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  BottomTabBar,
  ContextualStrip,
  DesignSystemV2Provider,
  ProjectChip,
} from '../v2/index.ts';
import type { BottomTabItem } from '../v2/BottomTabBar.tsx';
import BuildFooter from '../BuildFooter/BuildFooter.tsx';
import BuildStripLeading from '../builds/BuildStripLeading.tsx';
import BuildSubChrome from '../builds/BuildSubChrome.tsx';
import CookieConsentBanner from '../CookieConsentBanner/CookieConsentBanner.tsx';
import DriveRefreshProvider, {
  useDriveRefresh,
} from '../ProjectInterchangeBar/DriveRefreshProvider.tsx';
import DriveSaveFlowProvider, {
  useDriveSaveFlowContext,
} from '../SidebarDriveControls/DriveSaveFlowProvider.tsx';
import SidebarDriveControls from '../SidebarDriveControls/SidebarDriveControls.tsx';
import ChromeDismissibleNotices from '../shell/ChromeDismissibleNotices.tsx';
import QuickProjectSwitcher from '../shell/QuickProjectSwitcher.tsx';
import { useGoogleDrive } from '../../hooks/useGoogleDrive.ts';
import { useProjectChipStatus } from '../../hooks/useProjectChipStatus.ts';
import { useProjectPortableDirty } from '../../hooks/useProjectPortableDirty.ts';
import { usePageAnalytics } from '../../hooks/usePageAnalytics.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { handleExternalLinkClick, openExternalUrl } from '../../lib/openExternalUrl.ts';
import {
  activeContextualStripLabel,
  resolveContextualStripItems,
} from '../../nav/contextualStripItems.ts';
import { navActive } from '../../nav/navActive.ts';
import { primaryNavItems } from '../../nav/primaryNavItems.ts';
import { useBuildContextualStrip } from '../../nav/useBuildContextualStrip.ts';
import { activeBuildSectionLabel, isBuildDetailPath } from '../../routes/builds/nav.ts';
import { useProjects } from '../../state/useProjects.ts';
import shellClasses from '../v2/AppShell.module.css';
import classes from './AppLayout.module.css';
import { DESKTOP_MIN_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { HOME_MANAGE_HREF } from '../../routes/homeRedirect.ts';

export default function AppLayout() {
  usePageAnalytics();

  useEffect(() => {
    window.addEventListener('click', handleExternalLinkClick, true);
    return () => {
      window.removeEventListener('click', handleExternalLinkClick, true);
    };
  }, []);

  return (
    <DriveSaveFlowProvider>
      <DriveRefreshProvider>
        <AppLayoutShell />
      </DriveRefreshProvider>
    </DriveSaveFlowProvider>
  );
}

function AppLayoutShell() {
  const isDesktopNav = useMediaQuery(DESKTOP_MIN_WIDTH_MEDIA_QUERY);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeProjectId, activeProject, projects, switchProject } = useProjects();
  const hasActiveProject = activeProjectId != null;
  const { sessionExpired, connected } = useGoogleDrive();
  const { bannerOpen } = useDriveRefresh();
  const { saving } = useDriveSaveFlowContext();
  const { dirty } = useProjectPortableDirty(activeProjectId, activeProject ?? undefined);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const chipStatus = useProjectChipStatus({
    project: activeProject,
    hasActiveProject,
    dirty,
    saving,
    driveUpdateAvailable: bannerOpen,
    driveSessionExpired: sessionExpired && !connected,
    driveLinked: Boolean(activeProject?.interchange?.googleDrive),
  });

  const visibleTabs = primaryNavItems.filter((item) => !item.requiresProject || hasActiveProject);
  const tabLabels = visibleTabs.map((item) => item.label);
  const activePrimary = visibleTabs.find((item) => navActive(location.pathname, item.to)) ?? null;

  const staticStrip = resolveContextualStripItems(location.pathname);
  const buildStrip = useBuildContextualStrip(location.pathname);
  const stripItems = buildStrip ?? staticStrip;
  const buildDetailId = isBuildDetailPath(location.pathname)
    ? (location.pathname.match(/^\/builds\/([^/]+)/)?.[1] ?? null)
    : null;
  const stripActive = buildStrip
    ? buildDetailId
      ? activeBuildSectionLabel(location.pathname, buildDetailId)
      : null
    : stripItems
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
    if (!item) return;
    if (item.external) {
      void openExternalUrl(item.to);
      return;
    }
    navigate(item.to);
  }

  const projectName = hasActiveProject
    ? (activeProject?.name ?? 'Untitled project')
    : 'No project open';

  const compactChip = isDesktopNav === false;

  function handleProjectChipClick() {
    if (hasActiveProject && projects.length > 0) {
      setSwitcherOpen((open) => !open);
      return;
    }
    if (hasActiveProject) {
      navigate('/');
      return;
    }
    navigate('/');
  }

  const projectChip = (
    <ProjectChip
      name={projectName}
      statusTone={chipStatus.tone}
      statusLabel={chipStatus.label}
      compact={compactChip}
      onClick={handleProjectChipClick}
      aria-expanded={hasActiveProject ? switcherOpen : undefined}
      aria-haspopup={hasActiveProject ? 'dialog' : undefined}
    />
  );

  const projectChipControl =
    hasActiveProject && projects.length > 0 ? (
      <QuickProjectSwitcher
        opened={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onOpen={() => setSwitcherOpen(true)}
        mobile={compactChip}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={(id) => {
          switchProject(id);
          navigate('/library/channels');
        }}
        onNewProject={() => {
          setSwitcherOpen(false);
          navigate(HOME_MANAGE_HREF);
        }}
        onManageAll={() => {
          setSwitcherOpen(false);
          navigate(HOME_MANAGE_HREF);
        }}
      >
        {projectChip}
      </QuickProjectSwitcher>
    ) : (
      projectChip
    );

  const overflowAvatar = (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <button type="button" className={shellClasses.avatar} aria-label="Settings">
          <IconSettings size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />
        </button>
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

  const showBottomNav = isDesktopNav === false;

  return (
    <AppLayoutBody
      showBottomNav={showBottomNav}
      tabLabels={tabLabels}
      activePrimary={activePrimary}
      goToTab={goToTab}
      isDesktopNav={isDesktopNav}
      projectChipControl={projectChipControl}
      hasActiveProject={hasActiveProject}
      overflowAvatar={overflowAvatar}
      stripItems={stripItems}
      stripActive={stripActive}
      goToStrip={goToStrip}
      showBuildSwitcher={showBuildSwitcher}
      buildDetailId={buildDetailId}
      pathname={location.pathname}
      bottomItems={bottomItems}
    />
  );
}

interface AppLayoutBodyProps {
  showBottomNav: boolean;
  tabLabels: string[];
  activePrimary: (typeof primaryNavItems)[number] | null;
  goToTab: (label: string) => void;
  isDesktopNav: boolean | undefined;
  projectChipControl: ReactNode;
  hasActiveProject: boolean;
  overflowAvatar: ReactNode;
  stripItems: ReturnType<typeof resolveContextualStripItems>;
  stripActive: string | null;
  goToStrip: (label: string) => void;
  showBuildSwitcher: boolean;
  buildDetailId: string | null;
  pathname: string;
  bottomItems: BottomTabItem[];
}

function AppLayoutBody({
  showBottomNav,
  tabLabels,
  activePrimary,
  goToTab,
  isDesktopNav,
  projectChipControl,
  hasActiveProject,
  overflowAvatar,
  stripItems,
  stripActive,
  goToStrip,
  showBuildSwitcher,
  buildDetailId,
  pathname,
  bottomItems,
}: AppLayoutBodyProps) {
  const navigate = useNavigate();

  return (
    <div
      className={[classes.root, showBottomNav ? classes.rootWithBottomNav : '']
        .filter(Boolean)
        .join(' ')}
    >
      <DesignSystemV2Provider>
        <AppShell
          tabs={tabLabels}
          activeTab={activePrimary?.label}
          onTabChange={goToTab}
          showTabs={isDesktopNav !== false}
          projectChip={projectChipControl}
          onBrandClick={() => navigate(hasActiveProject ? '/library/channels' : '/')}
          rightExtra={hasActiveProject ? <SidebarDriveControls /> : undefined}
          avatar={overflowAvatar}
        />
        {stripItems && stripItems.length > 0 ? (
          <ContextualStrip
            items={stripItems.map((i) => i.label)}
            active={stripActive ?? undefined}
            onChange={goToStrip}
            leading={
              showBuildSwitcher && buildDetailId ? (
                <BuildStripLeading buildId={buildDetailId} mobile={isDesktopNav === false} />
              ) : undefined
            }
          />
        ) : null}
        {showBuildSwitcher ? <BuildSubChrome pathname={pathname} /> : null}
        <ChromeDismissibleNotices />
      </DesignSystemV2Provider>

      <main
        className={[classes.main, showBottomNav ? classes.mainScroll : '']
          .filter(Boolean)
          .join(' ')}
      >
        <CookieConsentBanner />
        <div className={classes.pageContent}>
          <Outlet />
          <BuildFooter />
        </div>
      </main>

      {showBottomNav ? (
        <DesignSystemV2Provider>
          <BottomTabBar items={bottomItems} activeId={activePrimary?.label} onChange={goToTab} />
        </DesignSystemV2Provider>
      ) : null}
    </div>
  );
}
