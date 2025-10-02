import CopyLayout from '@/layouts/CopyLayout'

export default function NotFound() {
  return (
    <CopyLayout
      statusCode="404"
      title="Page not found"
      subtitle="Sorry, we couldn't find the page you're looking for."
      primaryAction={{
        text: 'Go to the app',
        href: '/',
      }}
    />
  )
}
