import { Outlet } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';

/**
 * Scopes all `/builds/*` routes inside design-system v2 (dark tokens, `--dsv2-*` vars).
 */
export default function BuildsV2Layout() {
  return (
    <DesignSystemV2Provider>
      <Outlet />
    </DesignSystemV2Provider>
  );
}
