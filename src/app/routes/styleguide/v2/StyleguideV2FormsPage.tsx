import { Group, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { Button, OverrideField } from '../../../components/v2/index.ts';

const VARIANTS = ['primary', 'secondary', 'outline', 'dashed', 'ghost', 'destructive'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

export default function StyleguideV2FormsPage() {
  const [overridden, setOverridden] = useState(false);
  const [wireName, setWireName] = useState('GB3DA-DMR');

  return (
    <Page width="default">
      <PageHeader
        title="Forms"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection title="Button" description="Variants and sizes from the v2 token set.">
        <Stack gap="md">
          {SIZES.map((size) => (
            <Group key={size} gap="sm" wrap="wrap">
              {VARIANTS.map((variant) => (
                <Button key={`${size}-${variant}`} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
            </Group>
          ))}
        </Stack>
      </PageSection>

      <PageSection
        title="OverrideField"
        description="Library default vs per-build override chrome."
      >
        <OverrideField
          label="Wire name"
          description="CPS channel name for this build"
          overridden={overridden}
          onOverride={() => setOverridden(true)}
          onReset={() => {
            setOverridden(false);
            setWireName('GB3DA-DMR');
          }}
        >
          {overridden ? (
            <TextInput
              value={wireName}
              onChange={(e) => setWireName(e.currentTarget.value)}
              aria-label="Wire name value"
            />
          ) : null}
        </OverrideField>
      </PageSection>
    </Page>
  );
}
