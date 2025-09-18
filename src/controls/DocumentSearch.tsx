import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { KBarProvider, useKBar, useRegisterActions, type Action } from 'kbar'
import { trpc } from '@/trpc/client'
import { useMemo, useEffect, useState } from 'react'
import { KBarModal, KBarSearchInput, KBarResultRenderer } from './KBar'
import { docRoute } from '@/lib/utils'

const DocumentSearchContent = () => {
  const navigate = useNavigate()
  const kbarState = useKBar((state) => state)
  const query = kbarState.searchQuery || ''
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // TODO: This fires on page load and shouldn't.

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const searchDocs = trpc.doc.searchDocs.useQuery(
    { query: debouncedQuery },
    {
      enabled: true,
      staleTime: 10000,
      queryHash: 'search-docs',
    }
  )

  const actions = useMemo((): Action[] => {
    let actions: Action[] = []
    let exactMatch = false
    if (searchDocs.data) {
      console.log('update searchDocs with data ', searchDocs.data);
      actions = searchDocs.data.map((doc) => {
        if (doc.title.toLowerCase() === query.toLowerCase()) {
          exactMatch = true
        }
        return {
          id: `doc-${doc.id}`,
          name: doc.title,
          // TODO: Get a descriptive subtitle
          subtitle: 'Open document',
          perform: () => navigate({ to: docRoute(doc.id) }),
          keywords: doc.title.toLowerCase(),
        }
      })
    }

    if (!exactMatch) {
      actions.push({
        id: 'create-doc',
        name: `Create document titled ${query}`,
        subtitle: 'Create a new document',
        perform: () => {
          navigate({ to: docRoute(query) })
        },
        keywords: `create ${query}`,
      })
    }

    return actions
  }, [searchDocs.data, navigate, query])

  useRegisterActions(actions, [actions])

  return (
    <KBarModal>
      <KBarSearchInput placeholder="Search documents by title…" />
      <div className="overflow-y-auto">
        <KBarResultRenderer />
      </div>
    </KBarModal>
  )
}

interface DocumentSearchProps {
  children: React.ReactNode
}

export const DocumentSearch: React.FC<DocumentSearchProps> = ({ children }) => {
  return (
    <KBarProvider actions={[]}>
      <DocumentSearchContent />
      {children}
    </KBarProvider>
  )
}
