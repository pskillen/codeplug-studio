import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Anchor, Group, Notification, Portal, Text, UnstyledButton } from '@mantine/core';
import { Link } from 'react-router-dom';
import { isDeveloperModeOn } from '@integrations/preferences/developerMode.ts';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../../lib/githubLinks.ts';
import {
  developerModeTurnOnMessage,
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
 * The version text, and the five-tap developer-mode gesture on it (#1650). From the second tap a short countdown toast
 * shows; the fifth turns developer mode on. Taps never turn it off (#1686): while it is on they only say so and point
 * at the top bar's chip.
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
    const { state, result } = registerVersionTap(tapState.current, Date.now(), developerMode);
    tapState.current = state;
    let text = versionTapMessage(result);
    if (result.kind === 'turnOn') {
      setDeveloperMode(true);
      text = developerModeTurnOnMessage(isDeveloperModeOn());
    }
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
              // Top centre, over the top bar: the version label is in the page footer, at the bottom of the content
              // and (on a phone) just above the bottom tab bar, so a toast here never covers it (#1686).
              top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
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
