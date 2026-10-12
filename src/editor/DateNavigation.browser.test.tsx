import { useState } from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { DateNavigation } from './DateNavigation'
import { formatDate } from '@/lib/utils'
import '@/styles/styles.css'

afterEach(cleanup)

function Harness() {
  const [value, setValue] = useState('2024-02-29')
  return (
    <>
      <output>{value}</output>
      <DateNavigation value={value} onChange={setValue} />
    </>
  )
}

test('day navigation crosses leap-day boundaries without moving the calendar button', () => {
  const view = render(<Harness />)
  const x = view
    .getByRole('button', { name: 'Calendar' })
    .getBoundingClientRect().x
  fireEvent.click(view.getByRole('button', { name: 'Next day' }))
  expect(view.getByText('2024-03-01')).toBeTruthy()
  fireEvent.click(view.getByRole('button', { name: 'Previous day' }))
  expect(view.getByText('2024-02-29')).toBeTruthy()
  expect(
    view.getByRole('button', { name: 'Calendar' }).getBoundingClientRect().x
  ).toBe(x)
  expect(view.queryByRole('button', { name: 'Today' })).toBeNull()
})

test('the calendar supports arrow navigation, selection, and Today', async () => {
  const view = render(<Harness />)
  fireEvent.click(view.getByRole('button', { name: 'Calendar' }))
  const selected = await view.findByRole('button', { name: '2024-02-29' })
  selected.focus()
  fireEvent.keyDown(selected, { key: 'ArrowRight' })
  await waitFor(() =>
    expect(document.activeElement?.getAttribute('data-date')).toBe('2024-03-01')
  )
  fireEvent.click(view.getByRole('button', { name: '2024-03-01' }))
  expect(view.getByText('2024-03-01')).toBeTruthy()
  fireEvent.click(view.getByRole('button', { name: 'Calendar' }))
  fireEvent.click(await view.findByRole('button', { name: 'Today' }))
  expect(view.getByText(formatDate(new Date()))).toBeTruthy()
})
