import CopyLayout from '@/layout/CopyLayout'

export default function NotFound() {
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
