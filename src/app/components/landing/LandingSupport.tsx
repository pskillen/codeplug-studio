import { useMemo } from 'react';
import { buildSupportMatrix } from '@core/radio-targets/index.ts';
import { supportMatrixAvailability } from '../../services/supportMatrixAvailability.ts';
import { Button } from '../v2/index.ts';
import RadioFinder from './RadioFinder.tsx';
import RadioSupportMatrix from './RadioSupportMatrix.tsx';
import classes from './landing.module.css';

export interface LandingSupportProps {
  onStartProject: () => void;
  onImport: () => void;
}

/** Empty-state landing: short hero, radio finder, then the full support matrix. */
export default function LandingSupport({ onStartProject, onImport }: LandingSupportProps) {
  const rows = useMemo(() => buildSupportMatrix({ availability: supportMatrixAvailability() }), []);
  return (
    <div className={classes.landing}>
      <header className={classes.hero}>
        <h1 className={classes.heroTitle}>
          Design your codeplug once, program any supported radio
        </h1>
        <p className={classes.heroLead}>
          Keep one library of channels, talk groups and contacts, build it for each radio, then send
          it over the cable or export a file for the radio’s programming software.
        </p>
        <div className={classes.heroActions}>
          <Button onClick={onStartProject}>Create a project</Button>
          <Button variant="secondary" onClick={onImport}>
            Import a project
          </Button>
        </div>
        <span className={classes.heroNote}>Your projects stay in this browser.</span>
      </header>
      <RadioFinder rows={rows} onStartProject={onStartProject} />
      <RadioSupportMatrix rows={rows} />
    </div>
  );
}
