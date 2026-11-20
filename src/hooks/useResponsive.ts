/**
 * Responsive Design Hook — Web viewport dimensions + breakpoints.
 */
import { useEffect, useState } from 'react';

const getDims = () => ({
  width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  height: typeof window !== 'undefined' ? window.innerHeight : 768,
});

/**
 * Returns current viewport dimensions and breakpoint flags.
 * Updates on window resize.
 *
 * @returns width, height, isSmall (< 350px), isMobile (< 768px).
 */
export const useResponsive = () => {
  const [dims, setDims] = useState(getDims);

  useEffect(() => {
    const onResize = () => setDims(getDims());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    width: dims.width,
    height: dims.height,
    isSmall: dims.width < 350,
    isMobile: dims.width < 768,
  };
};
