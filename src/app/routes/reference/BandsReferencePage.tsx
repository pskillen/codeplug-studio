import { Anchor, Text } from '@mantine/core';
import BandPlanTable from '../../components/reference/BandPlanTable.tsx';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import classes from './BandsReferencePage.module.css';

const RSGB_BAND_PLAN_URL =
  'https://rsgb.services/public/bandplans/docs/240205_rsgb_band_plan_2024.pdf';

export default function BandsReferencePage() {
  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Band plan</h1>
        <p className={classes.description}>
          UK Ofcom amateur licence allocations plus common non-amateur receive services. Informational
          only — not enforced when programming channels. Source:{' '}
          <Anchor href={RSGB_BAND_PLAN_URL} target="_blank" rel="noopener noreferrer" size="sm">
            RSGB Band Plan (effective 1 Jan 2024)
          </Anchor>
          .
        </p>

        <div className={classes.tableWrap}>
          <BandPlanTable bare />
        </div>

        <Text size="sm" className={classes.disclaimer}>
          For programming convenience only. Not authoritative for on-air operation. Licence class,
          power, geographic restrictions, and non-amateur TX prohibitions apply.
        </Text>
      </div>
    </DesignSystemV2Provider>
  );
}
