import type { ReactNode } from 'react';
import { Anchor } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { DesignSystemV2Provider } from '../v2/index.ts';
import classes from './LegalDocumentLayout.module.css';

export interface LegalDocumentLayoutProps {
  title: string;
  lastUpdated?: string;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}

/**
 * U6 body-text-only legal template — back link, title, optional date, prose body. No page chrome panels.
 */
export default function LegalDocumentLayout({
  title,
  lastUpdated,
  backTo = '/help',
  backLabel = 'Back to Help',
  children,
}: LegalDocumentLayoutProps) {
  return (
    <DesignSystemV2Provider>
      <article className={classes.article}>
        <Anchor component={Link} to={backTo} className={classes.back} size="sm">
          <IconArrowLeft size={16} stroke={1.75} aria-hidden />
          {backLabel}
        </Anchor>
        <h1 className={classes.title}>{title}</h1>
        {lastUpdated ? <p className={classes.updated}>Last updated {lastUpdated}</p> : null}
        <div className={classes.body}>{children}</div>
      </article>
    </DesignSystemV2Provider>
  );
}
