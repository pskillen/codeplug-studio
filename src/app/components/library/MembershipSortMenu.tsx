import { Button, Menu } from '@mantine/core';
import { IconSortAscendingLetters } from '@tabler/icons-react';
import {
  MEMBERSHIP_SORT_MODE_LABELS,
  membershipSortConfirmMessage,
  type MembershipSortMode,
} from '@core/domain/membershipSort.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';

export interface MembershipSortMenuProps {
  /** Modes offered in the menu (default: all channel-oriented modes). */
  modes?: MembershipSortMode[];
  disabled?: boolean;
  onSort: (mode: MembershipSortMode) => void;
  label?: string;
}

const DEFAULT_MODES: MembershipSortMode[] = ['name', 'callsign', 'duplex', 'band', 'mode'];

export default function MembershipSortMenu({
  modes = DEFAULT_MODES,
  disabled,
  onSort,
  label = 'Sort…',
}: MembershipSortMenuProps) {
  const requestSort = (mode: MembershipSortMode) => {
    if (!window.confirm(membershipSortConfirmMessage(mode))) return;
    onSort(mode);
  };

  return (
    <Menu shadow="md" width={260} position="bottom-start">
      <Menu.Target>
        <Button
          type="button"
          variant="default"
          size="compact-sm"
          leftSection={<IconSortAscendingLetters size={14} stroke={ICON_STROKE} />}
          disabled={disabled}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Overwrite current order</Menu.Label>
        {modes.map((mode) => (
          <Menu.Item key={mode} onClick={() => requestSort(mode)}>
            {MEMBERSHIP_SORT_MODE_LABELS[mode]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
