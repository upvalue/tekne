import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './Dialog'

afterEach(cleanup)

const ControlledDialog = () => {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>Open details</DialogTrigger>
      <DialogContent>
        <DialogTitle>Details</DialogTitle>
        <DialogDescription>Some description</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  test('opens from the trigger and closes from the close button', () => {
    render(<ControlledDialog />)

    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Details')
    expect(dialog.textContent).toContain('Some description')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('closes on Escape', () => {
    render(<ControlledDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    expect(screen.getByRole('dialog')).not.toBeNull()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
