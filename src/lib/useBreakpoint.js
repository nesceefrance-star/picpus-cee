// src/lib/useBreakpoint.js
import { useState, useEffect } from 'react'

/**
 * Retourne les breakpoints courants basés sur window.innerWidth.
 * Breakpoints :  mobile < 640  /  tablet 640–1023  /  desktop ≥ 1024
 */
export function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  )
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler, { passive: true })
    return () => window.removeEventListener('resize', handler)
  }, [])
  return {
    width,
    isMobile:  width < 640,
    isTablet:  width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    isCompact: width < 1024, // mobile OR tablet
  }
}
