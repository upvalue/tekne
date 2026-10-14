import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { stripAppBasePath } from './app-path'

/** Merge conditional class names and resolve conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a date as YYYY-MM-DD in the local timezone. */
export function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

export const getDocTitle = () => {
  const path = stripAppBasePath(window.location.pathname)
  if (path.startsWith('/n/')) {
    return path.slice(3)
  }
  return null
}

export const docRoute = (name: string) => {
  return `/open/${encodeURIComponent(name)}`
}
