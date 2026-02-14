import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { trpc } from '@/trpc/client'
import { docRoute, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/vendor/Dialog'
import { Button } from '@/components/vendor/Button'
import { Input } from '@/components/vendor/Input'

export const TemplateDialog = () => {
  const [open, setOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [docName, setDocName] = useState('')
  const navigate = useNavigate()

  const templatesQuery = trpc.doc.listTemplates.useQuery(undefined, {
    enabled: open,
  })

  const createMutation = trpc.doc.createDocFromTemplate.useMutation({
    onSuccess: (data) => {
      setOpen(false)
      navigate({ to: docRoute(data.name) })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleClose = useCallback(() => {
    setOpen(false)
    setSelectedTemplate(null)
    setDocName('')
  }, [])

  useEffect(() => {
    const handler = () => {
      setOpen(true)
      setSelectedTemplate(null)
      setDocName(formatDate(new Date()))
    }
    window.addEventListener('tekne:new-from-template', handler)
    return () => window.removeEventListener('tekne:new-from-template', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate || !docName.trim()) return
    createMutation.mutate({ name: docName.trim(), templateName: selectedTemplate })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate
              ? `New document from ${selectedTemplate}`
              : 'Select a template'}
          </DialogTitle>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="flex flex-col gap-2">
            {templatesQuery.isLoading && (
              <p className="text-sm text-zinc-500">Loading templates...</p>
            )}
            {templatesQuery.data?.length === 0 && (
              <p className="text-sm text-zinc-500">
                No templates found. Create a document with a $ prefix to use as
                a template.
              </p>
            )}
            {templatesQuery.data?.map((name) => (
              <Button
                key={name}
                plain
                className="justify-start"
                onClick={() => setSelectedTemplate(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              autoFocus
              placeholder="Document name"
              value={docName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDocName(e.target.value)
              }
            />
            <div className="flex justify-end gap-2">
              <Button plain onClick={() => setSelectedTemplate(null)}>
                Back
              </Button>
              <Button
                type="submit"
                color="dark/zinc"
                disabled={!docName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
