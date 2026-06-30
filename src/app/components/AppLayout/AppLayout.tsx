import type { CSSProperties } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import BuildFooter from '../BuildFooter/BuildFooter.tsx';
import { useProjects } from '../../state/useProjects.ts';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/', label: 'Projects' },
  { to: '/library', label: 'Library' },
  { to: '/map', label: 'Map' },
  { to: '/repeaters', label: 'Repeaters' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
  { to: '/help', label: 'Help' },
];

function navLinkStyle({ isActive }: { isActive: boolean }): CSSProperties {
  return {
    padding: '0.35rem 0.7rem',
    borderRadius: 6,
    textDecoration: 'none',
    color: isActive ? '#fff' : '#1f2933',
    background: isActive ? '#2f6f4f' : 'transparent',
    fontWeight: isActive ? 600 : 500,
    fontSize: '0.9rem',
  };
}

export default function AppLayout() {
  const { activeProject } = useProjects();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
        color: '#1f2933',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 2rem',
          borderBottom: '1px solid #e4e7eb',
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '1.05rem' }}>Codeplug Studio</strong>
        <nav style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} style={navLinkStyle}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#52606d' }}>
          {activeProject ? (
            <>
              Active project: <strong>{activeProject.name}</strong>
            </>
          ) : (
            'No active project'
          )}
        </span>
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: 960, width: '100%' }}>
        <Outlet />
      </main>

      <BuildFooter />
    </div>
  );
}
