import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { EgressPathwayPills } from './EgressPathwayPills.tsx';
import classes from './BuildListCard.module.css';

export interface BuildListCardProps {
  build: RadioBuild;
}

export default function BuildListCard({ build }: BuildListCardProps) {
  const radio = radioTargetFor(build.radioTargetId);
  const updated = new Date(build.updatedAt).toLocaleString();

  return (
    <Link to={`/builds/${build.id}/export`} className={classes.card}>
      <div className={classes.topRow}>
        <div className={classes.name}>{build.name}</div>
        <div className={classes.updated}>{updated}</div>
      </div>
      <div className={classes.meta}>{radio?.label ?? build.radioTargetId}</div>
      {radio ? (
        <div className={classes.pathways}>
          <EgressPathwayPills egress={radio.compatibleEgress} />
        </div>
      ) : null}
    </Link>
  );
}

export function BuildsListSection({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={classes.section}>
      <h2 className={classes.sectionTitle}>{title}</h2>
      <div className={classes.cardGrid}>{children}</div>
    </section>
  );
}
