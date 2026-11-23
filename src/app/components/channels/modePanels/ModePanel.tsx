import type { ComponentType } from 'react';
import type { ModePanelProps } from './types.ts';
import { MODE_PANELS } from './registry.ts';

export default function ModePanel({ profile, onPatch, context }: ModePanelProps) {
  const Panel = MODE_PANELS[profile.mode] as ComponentType<ModePanelProps>;
  return <Panel profile={profile} onPatch={onPatch} context={context} />;
}