import { useState } from 'react';
import { Group } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/v2/index.ts';
import {
  DEMO_ACTIONS,
  RANGE_CHANGE_DEMO_STATES,
} from '../builds/danger-zone/rangeChange/rangeChangeDemo.ts';
import RangeChangeScreen from '../builds/danger-zone/rangeChange/RangeChangeScreen.tsx';

/**
 * Danger zone: Change frequency range, every step and the main failure screens with demo data (a synthetic
 * serial). Nothing talks to a radio. `?rangeChange=<state id>` opens a state directly (used for screenshots).
 */
export default function RangeChangeDemo() {
  const [search] = useSearchParams();
  const initial = search.get('rangeChange');
  const [id, setId] = useState(
    RANGE_CHANGE_DEMO_STATES.some((s) => s.id === initial) ? initial! : 'read',
  );
  const state = RANGE_CHANGE_DEMO_STATES.find((s) => s.id === id)!;
  return (
    <>
      <Group gap="xs">
        {RANGE_CHANGE_DEMO_STATES.map((s) => (
          <Button
            key={s.id}
            variant={s.id === id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setId(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </Group>
      <div data-testid="range-change-demo">
        <RangeChangeScreen view={state.view} actions={DEMO_ACTIONS} />
      </div>
    </>
  );
}
