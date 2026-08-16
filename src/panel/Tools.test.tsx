import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Tools } from './Tools'

const panelState = vi.hoisted(() => ({
  target: null as string | null,
  setTarget: vi.fn(),
}))

vi.mock('@/hooks/panel-state', () => ({
  useTagManagerTarget: () => [panelState.target, panelState.setTarget],
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    tags: {
      list: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
  },
}))

vi.mock('./tasks/CancelStaleTasks', () => ({
  CancelStaleTasks: () => <div data-testid="task-management" />,
}))

vi.mock('./tags/TagCard', () => ({
  TagCard: () => <div />,
}))

vi.mock('./tags/TagRenameDialog', () => ({
  TagRenameDialog: () => null,
}))

afterEach(cleanup)

beforeEach(() => {
  panelState.target = null
  panelState.setTarget.mockReset()
})

describe('Tools management tabs', () => {
  test('opens task management by default and switches to tag management', () => {
    render(<Tools />)

    expect(
      screen
        .getByRole('tab', { name: 'Task Management' })
        .getAttribute('aria-selected')
    ).toBe('true')
    expect(screen.getByTestId('task-management')).not.toBeNull()

    const tagTab = screen.getByRole('tab', { name: 'Tag Management' })
    fireEvent.focus(tagTab)
    fireEvent.keyDown(tagTab, { key: 'Enter' })

    expect(
      screen
        .getByRole('tab', { name: 'Tag Management' })
        .getAttribute('aria-selected')
    ).toBe('true')
    expect(screen.getByText('Document Tags')).not.toBeNull()
    expect(screen.getByText('All Tags')).not.toBeNull()
  })

  test('opens tag management when the editor supplies a tag target', () => {
    panelState.target = 'todo'
    render(<Tools />)

    expect(
      screen
        .getByRole('tab', { name: 'Tag Management' })
        .getAttribute('aria-selected')
    ).toBe('true')
  })
})
