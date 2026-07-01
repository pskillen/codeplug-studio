import { useEffect, useState } from 'react';

/** True once the document has finished loading stylesheets and subresources. */
export function useDocumentLayoutReady(): boolean {
  const [ready, setReady] = useState(() => document.readyState === 'complete');

  useEffect(() => {
    if (ready) return;
    const markReady = () => setReady(true);
    window.addEventListener('load', markReady, { once: true });
    return () => window.removeEventListener('load', markReady);
  }, [ready]);

  return ready;
}
