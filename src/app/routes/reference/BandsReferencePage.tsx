import { Alert, Anchor } from '@mantine/core';
import BandPlanTable from '../../components/reference/BandPlanTable.tsx';
import { ListPage, PageSection } from '../../components/ui/index.ts';

const RSGB_BAND_PLAN_URL =
  'https://rsgb.services/public/bandplans/docs/240205_rsgb_band_plan_2024.pdf';

export default function BandsReferencePage() {
  return (
    <ListPage
      title="Band plan"
      description={
        <>
          UK Ofcom amateur licence allocations plus common non-amateur receive services (broadcast,
          airband, marine, PMR446). Amateur ranges are licence allocations, not RSGB sub-band usage
          segments. Source:{' '}
          <Anchor href={RSGB_BAND_PLAN_URL} target="_blank" rel="noopener noreferrer">
            RSGB Band Plan (effective 1 Jan 2024)
          </Anchor>
          .
        </>
      }
    >
      <PageSection title="Allocation table">
        <BandPlanTable />
        <Alert color="gray" variant="light" mt="md">
          For programming convenience only. Not authoritative for on-air operation. Licence class,
          power, geographic restrictions, and non-amateur TX prohibitions apply.
        </Alert>
      </PageSection>
    </ListPage>
  );
}
