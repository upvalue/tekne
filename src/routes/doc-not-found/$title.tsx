import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/vendor/Button'
import { setMainTitle } from '@/lib/title'
import { useEffect } from 'react'
import { useCreateDoc } from '@/hooks/useCreateDoc'
import { NonEditorLayout } from '@/layout/NonEditorLayout'
import { EditorShell } from '@/layout/EditorShell'

export const Route = createFileRoute('/doc-not-found/$title')({
  component: RouteComponent,
})

function RouteComponent() {
  const title = Route.useParams({
    select: (p) => p.title,
  })

  useEffect(() => {
    setMainTitle(title)
  }, [title])

  const createDocMutation = useCreateDoc({ navigateOnSuccess: true })

  const handleCreateDocument = () => {
    createDocMutation.mutate({ name: title })
  }

  return (
    <EditorShell title={title}>
      <NonEditorLayout>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Document does not exist</h2>
          <p className="text-muted-foreground">
            The document "{title}" has not been created yet.
          </p>
        </div>
        <div>
          <Button
            onClick={handleCreateDocument}
            disabled={createDocMutation.isPending}
          >
            {createDocMutation.isPending ? 'Creating...' : 'Create Document'}
          </Button>
        </div>
      </NonEditorLayout>
    </EditorShell>
  )
}
