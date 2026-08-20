import { useEffect } from 'react';

/** The Propagation Visualiser moved off-Studio; see the Tools strip entry. */
export const RF_PROPAGATION_EXTERNAL_URL = 'https://propagation.mm9pdy.net/';

/**
 * Bookmark redirect for the retired in-app HF/RF propagation visualiser
 * (`/reference/rf-propagation`) — sends old links to the standalone product.
 */
export default function RfPropagationRedirectPage() {
  useEffect(() => {
    window.location.replace(RF_PROPAGATION_EXTERNAL_URL);
  }, []);

  return null;
}
