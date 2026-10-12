import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createStore, Provider } from 'jotai'
import { afterEach, expect, test, vi } from 'vitest'
import { docMake, lineMake } from '@/docs/schema'
import { runEditorMutation } from '@/lib/app-events'
import { docAtom } from '@/editor/state'
import { documentMutationPendingAtom } from '@/editor/document-sync-state'
import { useDocumentSync } from '@/editor/useDocumentSync'
import { EditorLayout } from './EditorLayout'
import { TitleBar } from '@/editor/TitleBar'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  patch: vi.fn(),
  propose: vi.fn(),
  rename: vi.fn(),
  navigate: vi.fn(),
  persist: vi.fn(),
  blocker: null as null | { shouldBlockFn: () => Promise<boolean> },
}))
vi.mock('@tanstack/react-router', () => ({
  useBlocker: (options: typeof mocks.blocker) => {
    mocks.blocker = options
  },
  useNavigate: () => mocks.navigate,
}))
vi.mock('@/api/client', () => ({
  orpcClient: {},
  orpc: {
    analysis: { key: () => ['analysis'] },
    doc: {
      patchDoc: {
        call: mocks.patch,
        mutationOptions: () => ({ mutationFn: mocks.patch }),
      },
      loadDoc: {
        queryOptions: ({ input, ...options }: { input: { name: string } }) => ({
          queryKey: ['doc', input],
          queryFn: mocks.load,
          ...options,
        }),
        queryKey: ({ input }: { input: { name: string } }) => ['doc', input],
        key: () => ['doc'],
      },
      renameDocPropose: {
        mutationOptions: () => ({ mutationFn: mocks.propose }),
      },
      renameDocExecute: {
        mutationOptions: () => ({ mutationFn: mocks.rename }),
      },
    },
  },
}))
vi.mock('@/editor/document-outbox', () => ({
  openDocumentOutbox: async () => ({
    recovered: null,
    otherDrafts: 0,
    write: mocks.persist,
    close: () => {},
  }),
}))
vi.mock('@/editor/StatusBar', () => ({ StatusBar: () => null }))

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.resetAllMocks()
})

async function setup() {
  const store = createStore()
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  clients.push(client)
  mocks.persist.mockResolvedValue(undefined)
  mocks.load.mockResolvedValue({
    doc: docMake([lineMake(0, 'original')]),
    revision: 0,
  })
  mocks.propose.mockResolvedValue({
    docAlreadyExists: false,
    linksToUpdate: [],
  })
  mocks.rename.mockResolvedValue({ newName: 'Renamed' })
  mocks.navigate.mockImplementation(async () => {
    expect(await mocks.blocker!.shouldBlockFn()).toBe(false)
  })
  function Editor() {
    useDocumentSync('Original', store)
    return (
      <EditorLayout
        editor={<TitleBar title="Original" allowTitleEdit />}
        sidepanel={null}
      />
    )
  }
  const view = render(
    <QueryClientProvider client={client}>
      <Provider store={store}>
        <Editor />
      </Provider>
    </QueryClientProvider>
  )
  await waitFor(() =>
    expect(store.get(docAtom).children[0].mdContent).toBe('original')
  )
  const title = view.getByRole('textbox', { name: 'Document title' })
  fireEvent.change(title, { target: { value: 'Renamed' } })
  fireEvent.blur(title)
  await waitFor(() =>
    expect(
      (view.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled
    ).toBe(false)
  )
  return { store, view }
}

test('rename waits for pending edits and durable acknowledgement, then navigation sees a clean queue', async () => {
  const { store, view } = await setup()
  let acknowledge!: (value: { status: 'ok'; revision: number }) => void
  mocks.patch.mockImplementation(
    () =>
      new Promise((resolve) => {
        acknowledge = resolve
      })
  )
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children[0].mdContent = 'unsaved edit'
    })
  )
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1))
  fireEvent.click(view.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(
      view.container.querySelector('[aria-busy]')?.hasAttribute('inert')
    ).toBe(true)
  )
  expect(mocks.rename).not.toHaveBeenCalled()
  await expect(runEditorMutation(async () => {})).rejects.toThrow(
    'Another document change'
  )
  let finishPersist!: () => void
  mocks.persist.mockImplementation((state) => {
    if (state.generation === state.ackedGeneration) {
      return new Promise<void>((resolve) => {
        finishPersist = resolve
      })
    }
    return Promise.resolve()
  })
  mocks.load.mockResolvedValue({ doc: store.get(docAtom), revision: 1 })
  await act(async () => acknowledge({ status: 'ok', revision: 1 }))
  await waitFor(() => expect(finishPersist).toBeDefined())
  expect(mocks.rename).not.toHaveBeenCalled()
  await act(async () => finishPersist())
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
  expect(mocks.rename).toHaveBeenCalledWith({
    oldName: 'Original',
    newName: 'Renamed',
  })
  expect(mocks.patch).toHaveBeenCalledTimes(1)
  const persisted = mocks.persist.mock.calls.at(-1)![0]
  expect(persisted.generation).toBe(persisted.ackedGeneration)
  expect(store.get(docAtom).children[0].mdContent).toBe('unsaved edit')
  await waitFor(() =>
    expect(store.get(documentMutationPendingAtom)).toBe(false)
  )
})

test('a failed save aborts rename and releases the editor without losing the edit', async () => {
  const { store, view } = await setup()
  mocks.patch.mockRejectedValue(new Error('offline'))
  act(() =>
    store.set(docAtom, (draft) => {
      draft.children[0].mdContent = 'keep this edit'
    })
  )
  fireEvent.click(view.getByRole('button', { name: 'Save' }))
  await view.findByRole('alert')
  expect(mocks.rename).not.toHaveBeenCalled()
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(store.get(docAtom).children[0].mdContent).toBe('keep this edit')
  expect(store.get(documentMutationPendingAtom)).toBe(false)
})

test('a failed rename releases the editor and preserves its saved content', async () => {
  const { store, view } = await setup()
  mocks.rename.mockRejectedValue(new Error('name taken'))
  fireEvent.click(view.getByRole('button', { name: 'Save' }))
  await view.findByRole('alert')
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(store.get(documentMutationPendingAtom)).toBe(false)
  expect(store.get(docAtom).children[0].mdContent).toBe('original')
})
