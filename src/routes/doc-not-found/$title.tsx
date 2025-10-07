import { createFileRoute } from '@tanstack/react-router'
import { EditorLayout } from '@/layout/EditorLayout'
import { TitleBar } from '@/editor/TitleBar'
import { Panel } from '@/panel/Panel'
import { Button } from '@/components/vendor/Button'
import { setMainTitle } from '@/lib/title'
import { useEffect } from 'react'
import { useCreateDoc } from '@/hooks/useCreateDoc'

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
    <EditorLayout
      editor={
        <>
          <TitleBar title={title} allowTitleEdit={false} />
          <div className="flex flex-col h-full space-y-4 p-8">

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
          </div>
        </>
      }
      sidepanel={<Panel />}
    />
  )
}
