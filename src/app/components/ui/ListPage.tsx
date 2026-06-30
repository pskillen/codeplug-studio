import type { ReactNode } from 'react';
import Page, { type PageProps } from './Page.tsx';
import PageHeader from './PageHeader.tsx';

export interface ListPageProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  width?: PageProps['width'];
}

export default function ListPage({
  title,
  description,
  actions,
  toolbar,
  children,
  width = 'default',
}: ListPageProps) {
  return (
    <Page width={width}>
      <PageHeader title={title} description={description} actions={actions} />
      {toolbar}
      {children}
    </Page>
  );
}
