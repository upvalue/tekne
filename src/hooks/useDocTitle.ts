import { useLocation } from '@tanstack/react-router'

/**
 * Non-hook function that extracts the document title from a pathname if it's on the /n/$title route,
 * otherwise returns null.
 */
export function getDocTitle(): string | null {
  const pathname = window.location.pathname
  // Check if we're on the /n/$title route
  if (pathname.startsWith('/n/')) {
    // Extract the title from the pathname (everything after /n/)
    const title = pathname.slice(3) // Remove '/n/' prefix
    return title || null
  }

  return null
}

/**
 * Hook that returns the document title from the route parameters if present on the /n/$title page,
 * otherwise returns null.
 */
export function useDocTitle(): string | null {
  const location = useLocation()
  return getDocTitle(location.pathname)
}
