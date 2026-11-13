import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Anchor, Group, Notification, Portal, Text, UnstyledButton } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../../lib/githubLinks.ts';
import {
  INITIAL_VERSION_TAP_STATE,
  registerVersionTap,
  versionTapMessage,
} from '../../services/developerModeTaps.ts';
import { DSV2_TOKENS } from '../../theme-v2.ts';

/** How long a developer-mode toast stays up. */
export const DEVELOPER_MODE_TOAST_MS = 2000;

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Text component={Link} to={to} size="sm" c="dimmed" style={{ textDecoration: 'none' }}>
      {children}
    </Text>
  );
}

/**
 * The version text, and the five-tap developer-mode gesture on it (#1650). Each tap after the second shows a short
 * countdown toast; the fifth turns developer mode on (or off when it is on).
 */
function VersionTapTarget() {
  const [developerMode, setDeveloperMode] = useDeveloperMode();
  const tapState = useRef(INITIAL_VERSION_TAP_STATE);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), DEVELOPER_MODE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const onTap = () => {
    const { state, result } = registerVersionTap(tapState.current, Date.now());
    tapState.current = state;
    const text = versionTapMessage(result, developerMode);
    if (result.kind === 'toggle') setDeveloperMode(!developerMode);
    if (text) setToast({ text, id: Date.now() });
  };

  return (
    <>
      <UnstyledButton
        onClick={onTap}
        fz="sm"
        c="dimmed"
        style={{ cursor: 'default', userSelect: 'none' }}
        aria-label={`Codeplug Studio version ${__BUILD_VERSION__} (${__BUILD_ENV__})`}
        data-testid="build-version"
      >
        Codeplug Studio · {__BUILD_ENV__} · {__BUILD_VERSION__}
      </UnstyledButton>
      {toast ? (
        <Portal>
          <Notification
            key={toast.id}
            role="status"
            aria-live="polite"
            withCloseButton={false}
            withBorder
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            {toast.text}
          </Notification>
        </Portal>
      ) : null}
    </>
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
      style={{ borderTop: `1px solid ${DSV2_TOKENS.colors.border}` }}
    >
      <Group gap="xs" wrap="wrap">
        <VersionTapTarget />
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
