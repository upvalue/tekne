const configuredBase = import.meta.env.BASE_URL || '/'

/**
 * The application's mount point without a trailing slash.
 *
 * Production is mounted at the origin root, while the development instance is
 * mounted at /dev. TanStack Router uses this as its basepath.
 *
 * No file route may use the mount point as its path. TanStack Router strips the
 * basepath from route paths as well as from the location, so a route at '/dev'
 * would collapse to '/' and outrank the real index route.
 */
export const appBasePath =
  configuredBase === '/' ? '' : configuredBase.replace(/\/+$/, '')

/** Prefix an application-internal absolute path with the configured mount. */
export const appPath = (path: string): string => {
  const absolutePath = path.startsWith('/') ? path : `/${path}`
  return `${appBasePath}${absolutePath}` || '/'
}

/** Remove the configured mount from a browser pathname before parsing it. */
export const stripAppBasePath = (pathname: string): string => {
  if (!appBasePath) return pathname
  if (pathname === appBasePath) return '/'
  if (pathname.startsWith(`${appBasePath}/`)) {
    return pathname.slice(appBasePath.length)
  }
  return pathname
}
