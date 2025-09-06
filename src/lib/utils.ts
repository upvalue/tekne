import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind friendly classnames merger
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date in the standard YYYY-MM-DD
 */
export function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

export const getDocTitle = () => {
  const path = window.location.pathname
  if (path.startsWith('/n/')) {
    return path.slice(3)
  }
  return null
}

export const docRoute = (name: string) => {
  return `/n/${encodeURIComponent(name)}`
}
