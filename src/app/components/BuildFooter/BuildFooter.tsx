import type { ReactNode } from 'react';
import { Anchor, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../../lib/githubLinks.ts';

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Text component={Link} to={to} size="sm" c="dimmed" style={{ textDecoration: 'none' }}>
      {children}
    </Text>
  );
}

export default function BuildFooter() {
  return (
    <Text
      component="div"
      size="sm"
      c="dimmed"
      mt="xl"
      pt="md"
      style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
    >
      <Group gap="xs" wrap="wrap">
        <span>
          Codeplug Studio · {__BUILD_ENV__} · {__BUILD_VERSION__}
        </span>
        <Text span inherit c="dimmed">
          ·
        </Text>
        <FooterLink to="/cookies">Cookies</FooterLink>
        <Text span inherit c="dimmed">
          ·
        </Text>
        <FooterLink to="/privacy">Privacy</FooterLink>
        <Text span inherit c="dimmed">
          ·
        </Text>
        <FooterLink to="/terms">Terms</FooterLink>
        <Text span inherit c="dimmed">
          ·
        </Text>
        <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" size="sm" c="dimmed">
          Repository
        </Anchor>
        <Text span inherit c="dimmed">
          ·
        </Text>
        <Anchor href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer" size="sm" c="dimmed">
          Report a bug
        </Anchor>
      </Group>
    </Text>
  );
}
