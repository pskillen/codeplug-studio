import { Group, Paper } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { FormEvent, ReactNode } from 'react';
import Page, { type PageProps } from './Page.tsx';
import PageHeader from './PageHeader.tsx';

export interface FormPageProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  width?: PageProps['width'];
}

function FormFooter({ footer, sticky }: { footer: ReactNode; sticky: boolean }) {
  if (sticky) {
    return (
      <Paper withBorder p="sm" radius="md" pos="sticky" bottom={0} style={{ zIndex: 10 }}>
        <Group justify="flex-end" gap="sm">
          {footer}
        </Group>
      </Paper>
    );
  }
  return (
    <Group justify="flex-end" gap="sm" mt="md">
      {footer}
    </Group>
  );
}

export default function FormPage({
  title,
  description,
  children,
  footer,
  onSubmit,
  width = 'default',
}: FormPageProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');

  const body = (
    <>
      {children}
      {footer ? <FormFooter footer={footer} sticky={Boolean(isMobile)} /> : null}
    </>
  );

  return (
    <Page width={width}>
      <PageHeader title={title} description={description} />
      {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
    </Page>
  );
}
