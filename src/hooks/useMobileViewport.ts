'use client';

import { useEffect, useState } from 'react';

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

/**
 * Returns a conservative viewport flag. The first render is deliberately
 * marked as not-ready so responsive-only behavior cannot mount expensive
 * WebGL content before the browser reports its actual viewport.
 */
export function useMobileViewport() {
  const [viewport, setViewport] = useState({ isMobile: false, ready: false });

  useEffect(() => {
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setViewport({ isMobile: media.matches, ready: true });

    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return viewport;
}
