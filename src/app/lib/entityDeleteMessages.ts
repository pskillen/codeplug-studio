import type { EntityReference } from '@core/domain/references.ts';

export function formatEntityReferences(references: EntityReference[]): string {
  return references
    .map((ref) => `${ref.fromName} (${ref.relationship})`)
    .join('; ');
}

export function referencesAreZoneMembershipOnly(references: EntityReference[]): boolean {
  return references.length > 0 && references.every((ref) => ref.fromKind === 'zone');
}
