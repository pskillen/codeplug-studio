import { ActionIcon, Button, Group, Menu } from '@mantine/core';
import type { ButtonProps } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './SplitButton.module.css';

export interface SplitButtonMenuItem {
  label: string;
  onClick: () => void;
  leftSection?: ReactNode;
  disabled?: boolean;
}

export interface SplitButtonProps {
  /** Primary action label and handler (left segment). */
  label: string;
  onClick: () => void;
  /** Secondary actions in the chevron menu. */
  menuItems: readonly SplitButtonMenuItem[];
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  fullWidth?: boolean;
}

/**
 * Primary button with a menu trigger for secondary actions.
 * Adapted from [Mantine UI — Split button](https://ui.mantine.dev/category/buttons/#split-button).
 */
export default function SplitButton({
  label,
  onClick,
  menuItems,
  loading,
  disabled,
  variant = 'light',
  size = 'xs',
  fullWidth,
}: SplitButtonProps) {
  const menuDisabled = disabled || loading || menuItems.length === 0;
  const enabledMenuItems = menuItems.filter((item) => !item.disabled);

  return (
    <Group gap={0} wrap="nowrap" w={fullWidth ? '100%' : undefined}>
      <Button
        className={classes.button}
        variant={variant}
        size={size}
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        style={fullWidth ? { flex: 1 } : undefined}
      >
        {label}
      </Button>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            className={classes.menuControl}
            variant={variant}
            size={size}
            disabled={menuDisabled || enabledMenuItems.length === 0}
            aria-label="More actions"
          >
            <IconChevronDown size={16} stroke={ICON_STROKE} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {menuItems.map((item) => (
            <Menu.Item
              key={item.label}
              leftSection={item.leftSection}
              disabled={item.disabled || disabled || loading}
              onClick={item.onClick}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
