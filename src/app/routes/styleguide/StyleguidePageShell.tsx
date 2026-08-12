import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../../components/v2/index.ts';
import classes from './StyleguidePageShell.module.css';

export interface StyleguidePageShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function StyleguidePageShell({ title, description, children }: StyleguidePageShellProps) {
  return (
    <div className={classes.page}>
      <p className={classes.back}>
        <Link to="/styleguide">← Styleguide</Link>
      </p>
      <h1 className={classes.title}>{title}</h1>
      {description ? <p className={classes.description}>{description}</p> : null}
      <div className={classes.body}>{children}</div>
    </div>
  );
}

export interface StyleguideSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function StyleguideSection({ title, description, children }: StyleguideSectionProps) {
  return (
    <Panel title={title}>
      {description ? <p className={classes.sectionDescription}>{description}</p> : null}
      {children}
    </Panel>
  );
}
