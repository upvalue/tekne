import { TEditor } from '@/editor/TEditor'
import { createFileRoute } from '@tanstack/react-router'
import { docAtom } from '@/editor/state'
import { docMake, lineMake } from '@/docs/schema'
import { Provider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import { EditorLayout } from '@/layout/EditorLayout'
import { Panel } from '@/panel/Panel'
import { TitleBar } from '@/editor/TitleBar'
import { useCodemirrorEvent } from '@/editor/line-editor'
import { toast } from 'sonner'

export const Route = createFileRoute('/lab')({
  component: RouteComponent,
})

const ExampleDoc = ({ children }: { children: React.ReactNode }) => {
  useHydrateAtoms([
    [
      docAtom,
      docMake([
        {
          ...lineMake(
            0,
            '_italic_ **bold** ~~strikethrough~~ '
          ),
        },
      ]),
    ],
  ])

  return children
}

function RouteComponent() {
  useCodemirrorEvent('internalLinkClick', (data) => {
    toast.info(`Clicked internal link ${data.link}`)
  })

  useCodemirrorEvent('tagClick', (data) => {
    toast.info(`Clicked tag ${data.name}`)
  })

  return (
    <Provider>
      <ExampleDoc>
        <EditorLayout
          editor={
            <>
              <TitleBar title="Lab" allowTitleEdit={false} />
              <TEditor />
            </>
          }
          sidepanel={<Panel />}
        />
      </ExampleDoc>
    </Provider>
  )
}
