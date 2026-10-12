import { useMatch } from '@tanstack/react-router'

/** The decoded document title, or null outside the editor route. */
export function useDocTitle(): string | null {
  const match = useMatch({ from: '/n/$title', shouldThrow: false })
  return match?.params.title ?? null
}
