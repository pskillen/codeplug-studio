import { Outlet } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';

/** Nested layout for `/styleguide/*` — scopes all kit demos inside DesignSystemV2Provider. */
export default function StyleguideLayout() {
  return (
    <DesignSystemV2Provider>
      <Outlet />
    </DesignSystemV2Provider>
  );
}
