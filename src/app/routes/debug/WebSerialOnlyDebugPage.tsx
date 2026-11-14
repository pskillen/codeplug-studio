import { Alert } from '@mantine/core';
import type { ReactNode } from 'react';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { isNativeApp } from '@integrations/platform/isNativeApp.ts';

export interface WebSerialOnlyDebugPageProps {
  /** The page's own title, kept in the Android app so the operator sees which page they opened. */
  title: string;
  /** The page itself, rendered unchanged everywhere but the Android app. */
  children: ReactNode;
}

/**
 * Wraps a Debug page that talks to a radio or cable over Web Serial (#1673). These pages open the port through
 * `navigator.serial`, which the Android app's web view does not have, and they do not use the app's USB serial
 * transport. So in the app the page shows its title and a plain notice instead of controls that would fail when
 * tapped. In a browser it renders `children` and nothing else, so the page behaves exactly as before.
 */
export default function WebSerialOnlyDebugPage({ title, children }: WebSerialOnlyDebugPageProps) {
  if (!isNativeApp()) return <>{children}</>;
  return (
    <Page>
      <PageHeader title={title} />
      <Alert color="yellow" title="Not available in the Android app">
        This page talks to the radio or cable over Web Serial, which the Android app does not have.
        Open it in Chrome or Edge on a desktop computer.
      </Alert>
    </Page>
  );
}
