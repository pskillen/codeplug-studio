import { NavLink, Stack } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { entityNavIcons } from '../../../nav/entityNavIcons.ts';
import { LIBRARY_NAV } from '../../../routes/library/nav.ts';

const CHANNEL_DEFAULTS_PATH = '/library/channels/defaults';
const ZONE_DEFAULTS_PATH = '/library/zones/defaults';
const ChannelDefaultsIcon = entityNavIcons.channelDefaults;
const ZoneDefaultsIcon = entityNavIcons.zoneDefaults;

export default function LibraryNavLinks() {
  const location = useLocation();

  return (
    <Stack gap={4}>
      {LIBRARY_NAV.map((entry) => {
        const Icon = entry.icon;
        const isChannels = entry.listPath === '/library/channels';
        const isZones = entry.listPath === '/library/zones';
        const channelsActive =
          location.pathname === entry.listPath ||
          location.pathname.startsWith(`${entry.listPath}/`) ||
          location.pathname === CHANNEL_DEFAULTS_PATH;
        const zonesActive =
          location.pathname === entry.listPath ||
          location.pathname.startsWith(`${entry.listPath}/`) ||
          location.pathname === ZONE_DEFAULTS_PATH;

        return (
          <Stack key={entry.listPath} gap={2}>
            <NavLink
              component={Link}
              to={entry.listPath}
              label={entry.plural}
              leftSection={<Icon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
              active={
                isChannels
                  ? channelsActive
                  : isZones
                    ? zonesActive
                    : location.pathname.startsWith(entry.listPath)
              }
            />
            {isChannels ? (
              <NavLink
                component={Link}
                to={CHANNEL_DEFAULTS_PATH}
                label="Channel defaults"
                leftSection={<ChannelDefaultsIcon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                active={location.pathname === CHANNEL_DEFAULTS_PATH}
                styles={{ root: { paddingLeft: 'var(--mantine-spacing-md)' } }}
              />
            ) : null}
            {isZones ? (
              <NavLink
                component={Link}
                to={ZONE_DEFAULTS_PATH}
                label="Zone defaults"
                leftSection={<ZoneDefaultsIcon size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                active={location.pathname === ZONE_DEFAULTS_PATH}
                styles={{ root: { paddingLeft: 'var(--mantine-spacing-md)' } }}
              />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
