import { CopyLayout } from './CopyLayout'

/** 404 page, used by the /404 route and as the router's default not-found. */
export function NotFound() {
  return (
    <CopyLayout
      statusCode="404"
      title="Page not found"
      primaryAction={{
        text: 'Go to the app',
        href: '/',
      }}
    />
  )
}
