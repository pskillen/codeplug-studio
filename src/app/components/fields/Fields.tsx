import type { ReactNode } from 'react';

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.6rem 0' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3e4c59' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '0.75rem', color: '#7b8794' }}>{hint}</span>}
    </label>
  );
}
