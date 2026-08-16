import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useState } from 'react'
import type { ProposedDocumentEdits } from '@/docs/doc-diff'
import { DocumentEditsReview } from './DocumentEditsReview'

vi.mock('./ChangeRows', () => ({
  ChangeRows: ({ changes }: { changes: Array<{ marker?: string }> }) => (
    <div data-testid="changes">{changes[0]?.marker}</div>
  ),
}))

const documents = [
  {
    title: 'Alpha',
    isTemplate: false,
    changes: [{ kind: 'changed', marker: 'alpha change' }],
  },
  {
    title: 'Beta',
    isTemplate: false,
    changes: [{ kind: 'changed', marker: 'beta change' }],
  },
] as unknown as ProposedDocumentEdits[]

afterEach(cleanup)

const SelectableReview = () => {
  const [selected, setSelected] = useState(
    new Set(documents.map((document) => document.title))
  )
  return (
    <DocumentEditsReview
      documents={documents}
      selectedTitles={selected}
      onSelectedTitlesChange={setSelected}
    />
  )
}

describe('DocumentEditsReview', () => {
  test('focuses documents independently of their selection', () => {
    render(<SelectableReview />)

    expect(screen.getByTestId('changes').textContent).toBe('alpha change')
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }))
    expect(screen.getByTestId('changes').textContent).toBe('beta change')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Beta' }))
    expect(
      screen
        .getByRole('checkbox', { name: 'Include Beta' })
        .getAttribute('aria-checked')
    ).toBe('false')
    expect(screen.getByTestId('changes').textContent).toBe('beta change')
  })

  test('supports select all and select none', () => {
    render(<SelectableReview />)

    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox.getAttribute('aria-checked')).toBe('false')
    }

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox.getAttribute('aria-checked')).toBe('true')
    }
  })

  test('omits selection controls in read-only mode', () => {
    render(<DocumentEditsReview documents={documents} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Select all' })).toBeNull()
  })
})
