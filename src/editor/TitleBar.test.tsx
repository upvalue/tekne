import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, test, vi } from 'vitest'
import { TitleBar } from './TitleBar'

const mocks = vi.hoisted(() => ({
  propose: vi.fn(),
  execute: vi.fn(),
  navigate: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  orpc: {
    doc: {
      renameDocPropose: {
        mutationOptions: () => ({ mutationFn: mocks.propose }),
      },
      renameDocExecute: {
        mutationOptions: () => ({ mutationFn: mocks.execute }),
      },
    },
  },
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('./StatusBar', () => ({ StatusBar: () => null }))
vi.mock('./DateNavigation', () => ({ DateNavigation: () => null }))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const setup = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <TitleBar title="Original" allowTitleEdit />
    </QueryClientProvider>
  )

test('blur keeps inline confirmation visible and Save renames the reviewed title', async () => {
  mocks.propose.mockResolvedValue({
    docAlreadyExists: false,
    linksToUpdate: [{ title: 'Linked page' }],
  })
  mocks.execute.mockResolvedValue({})
  const view = setup()
  const title = view.getByRole('textbox', { name: 'Document title' })
  fireEvent.change(title, { target: { value: 'Renamed' } })
  fireEvent.blur(title)
  await view.findByText('Also updates links in Linked page.')
  expect(view.queryByRole('dialog')).toBeNull()
  expect(mocks.execute).not.toHaveBeenCalled()
  fireEvent.click(view.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(mocks.execute).toHaveBeenCalledWith({
      oldName: 'Original',
      newName: 'Renamed',
    })
  )
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/n/$title',
      params: { title: 'Renamed' },
    })
  )
})

test('Cancel restores the title and ignores a pending preview response', async () => {
  let resolve!: (value: unknown) => void
  mocks.propose.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const view = setup()
  const title = view.getByRole('textbox', {
    name: 'Document title',
  }) as HTMLInputElement
  fireEvent.change(title, { target: { value: 'Renamed' } })
  fireEvent.blur(title)
  await waitFor(() => expect(mocks.propose).toHaveBeenCalled())
  fireEvent.click(view.getByRole('button', { name: 'Cancel' }))
  resolve({ docAlreadyExists: false, linksToUpdate: [] })
  await waitFor(() => expect(title.value).toBe('Original'))
  expect(view.queryByRole('button', { name: 'Save' })).toBeNull()
  expect(mocks.execute).not.toHaveBeenCalled()
})

test('an existing destination keeps the draft and blocks saving', async () => {
  mocks.propose.mockResolvedValue({ docAlreadyExists: true, linksToUpdate: [] })
  const view = setup()
  const title = view.getByRole('textbox', {
    name: 'Document title',
  }) as HTMLInputElement
  fireEvent.change(title, { target: { value: 'Existing' } })
  fireEvent.blur(title)
  await view.findByRole('alert')
  expect(title.value).toBe('Existing')
  expect(
    (view.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled
  ).toBe(true)
})
