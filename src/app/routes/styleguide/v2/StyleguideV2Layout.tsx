import { Outlet } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../../components/v2/index.ts';

/**
 * Nested layout for `/styleguide/v2/*` — scopes all demos inside DesignSystemV2Provider.
 */
export default function StyleguideV2Layout() {
  return (
    <DesignSystemV2Provider>
      <Outlet />
    </DesignSystemV2Provider>
  );
}
