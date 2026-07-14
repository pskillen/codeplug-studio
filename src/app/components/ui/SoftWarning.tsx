import { Box, CloseButton, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './SoftWarning.module.css';

export type SoftWarningTone = 'warning' | 'danger';

export interface SoftWarningProps {
  /** Amber for general notices; red for auth/session issues. */
  tone?: SoftWarningTone;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

/**
 * Compact tinted panel for non-blocking sidebar and chrome warnings.
 * Tuned for the default dark shell — uses light-dark() for future light mode.
 */
export default function SoftWarning({
  tone = 'warning',
  title,
  children,
  onDismiss,
  dismissLabel = 'Dismiss warning',
}: SoftWarningProps) {
  const toneClass = tone === 'danger' ? classes.danger : classes.warning;
  const titleClass = tone === 'danger' ? classes.titleDanger : classes.title;

  return (
    <Box
      className={`${classes.root} ${toneClass} ${onDismiss ? classes.dismissible : ''}`}
      data-tone={tone}
    >
      {onDismiss ? (
        <CloseButton
          aria-label={dismissLabel}
          className={classes.close}
          size="sm"
          onClick={onDismiss}
        />
      ) : null}
      <Stack gap={4}>
        {title ? <Text className={titleClass}>{title}</Text> : null}
        {typeof children === 'string' ? <Text className={classes.body}>{children}</Text> : children}
      </Stack>
    </Box>
  );
}
