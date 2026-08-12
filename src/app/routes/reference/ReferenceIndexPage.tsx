import { Text } from '@mantine/core';
import { DesignSystemV2Provider, Panel } from '../../components/v2/index.ts';
import classes from './ReferenceIndexPage.module.css';

export default function ReferenceIndexPage() {
  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Reference</h1>
        <p className={classes.description}>
          Lookup tables and helpers for amateur radio programming — not authoritative for on-air
          operation.
        </p>
        <Panel title="Tools">
          <Text size="sm" className={classes.panelCopy}>
            Choose a reference tool from the sidebar.
          </Text>
        </Panel>
      </div>
    </DesignSystemV2Provider>
  );
}
