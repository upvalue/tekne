import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Checkbox } from './Checkbox'
import '@/styles/styles.css'

describe('Checkbox state rendering', () => {
  test('renders the incomplete state', () => {
    const { getByRole } = render(
      <Checkbox checked indeterminate aria-label="Incomplete task" />
    )

    const checkbox = getByRole('checkbox', { name: 'Incomplete task' })
    const icon = checkbox.querySelector('svg')!
    const [checkmark, incomplete] = icon.querySelectorAll('path')

    expect(checkbox.getAttribute('aria-checked')).toBe('mixed')
    expect(getComputedStyle(icon).opacity).toBe('1')
    expect(getComputedStyle(checkmark).opacity).toBe('0')
    expect(getComputedStyle(incomplete).opacity).toBe('1')
  })
})
