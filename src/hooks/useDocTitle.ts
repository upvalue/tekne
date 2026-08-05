import { useLocation } from '@tanstack/react-router'
import { stripAppBasePath } from '@/lib/app-path'

/**
 * Hook that returns the document title from the route parameters if present on the /n/$title page,
 * otherwise returns null.
 *
 * (For non-hook contexts, getDocTitle in @/lib/utils reads the same thing
 * from window.location.)
 */
export function useDocTitle(): string | null {
  const location = useLocation()
  const pathname = stripAppBasePath(location.pathname)
  if (pathname.startsWith('/n/')) {
    return pathname.slice(3)
  }
  return null
}
