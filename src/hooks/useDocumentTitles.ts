import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/api/client'

/**
 * Every document title, cached and filtered by the caller. Searching per
 * keystroke started each query with no data, so the palette's list emptied
 * and refilled while typing.
 */
export const useDocumentTitles = () =>
  useQuery(
    orpc.doc.searchDocs.queryOptions({
      input: { query: '' },
      staleTime: 30_000,
    })
  )
