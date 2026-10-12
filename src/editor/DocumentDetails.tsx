import { LoadingIndicator } from '@/components/LoadingIndicator'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/vendor/Dialog'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { orpc } from '@/api/client'
import { DialogDescription } from '@/components/vendor/Dialog'

const DocumentDetails = ({ title }: { title: string }) => {
  const { isLoading, data } = useQuery(
    orpc.doc.loadDocDetails.queryOptions({
      input: {
        name: title,
      },
    })
  )

  return (
    <div>
      {isLoading && <LoadingIndicator label="Loading document details" />}
      {!isLoading && (
        <div>
          <p>Created at: {data?.createdAt.toISOString()}</p>
          <p>Updated at: {data?.updatedAt.toISOString()}</p>
          <p>Revision: {data?.revision}</p>
        </div>
      )}
    </div>
  )
}

export const DocumentDetailsButton = ({ title }: { title: string }) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <FileText className="w-4 h-4 cursor-pointer text-muted" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <DialogDescription>Document details</DialogDescription>
        {open && <DocumentDetails title={title} />}
      </DialogContent>
    </Dialog>
  )
}
