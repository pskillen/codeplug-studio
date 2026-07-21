import { Burger, Group, UnstyledButton } from '@mantine/core';
import { Link } from 'react-router-dom';

export interface AppHeaderProps {
  opened: boolean;
  onToggle: () => void;
}

/** Wordmark height in the 56px AppShell header. */
const LOGO_HEIGHT_PX = 28;

export default function AppHeader({ opened, onToggle }: AppHeaderProps) {
  return (
    <Group h="100%" px="md" gap="sm">
      <Burger
        opened={opened}
        onClick={onToggle}
        hiddenFrom="sm"
        size="sm"
        aria-label="Toggle navigation"
      />
      <UnstyledButton
        component={Link}
        to="/"
        aria-label="Codeplug Studio home"
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <img
          src="/branding/studio-logo.svg"
          alt="Codeplug Studio"
          height={LOGO_HEIGHT_PX}
          style={{ display: 'block', height: LOGO_HEIGHT_PX, width: 'auto' }}
        />
      </UnstyledButton>
    </Group>
  );
}
