import React from 'react'
import { Button } from '@/components/vendor/Button'
import manifest from './manifest.json'

interface DocsNavigationProps {
  selectedDoc: string | null
  onSelectDoc: (docName: string) => void
}

export function DocsNavigation({
  selectedDoc,
  onSelectDoc,
}: DocsNavigationProps) {
  const docFiles = manifest.files.map((file) => {
    const filename = file.outputFile.split('/').pop()?.replace('.tsx', '') || ''
    return {
      name: filename,
      title: file.metadata.title || filename,
      metadata: file.metadata,
    }
  })

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Documentation</h3>
      {docFiles.map((doc) => (
        <Button
          key={doc.name}
          {...(selectedDoc === doc.name ? { color: 'zinc' } : { plain: true })}
          className="w-full justify-start text-left"
          onClick={() => onSelectDoc(doc.name)}
        >
          {doc.title}
        </Button>
      ))}
    </div>
  )
}
