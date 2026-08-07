import type { ReactNode } from 'react';
import { DesignSystemV2Provider, EditorHeader } from '../v2/index.ts';
import classes from './DirectoryIngestPage.module.css';

export interface DirectoryIngestPageProps {
  crumb: string;
  crumbTo: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * mk2 Batch 5 directory/ingest page shell — EditorHeader + v2-scoped content.
 */
export default function DirectoryIngestPage({
  crumb,
  crumbTo,
  title,
  subtitle,
  children,
  footer,
}: DirectoryIngestPageProps) {
  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <EditorHeader crumb={crumb} crumbTo={crumbTo} title={title} subtitle={subtitle} />
        <div className={classes.content}>{children}</div>
        {footer ? <div className={classes.footer}>{footer}</div> : null}
      </div>
    </DesignSystemV2Provider>
  );
}
