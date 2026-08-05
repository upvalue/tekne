import { GUTTER_WIDTH_PIXELS } from '@/editor/constants'

/**
 * Pads a non editor page (like the not found document) to look like the
 * editor. The gutter padding is an inline style because Tailwind's static
 * extractor can't see a class name built at runtime.
 */
export const NonEditorLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div
      className="flex flex-col h-full space-y-4 py-4"
      style={{ paddingInline: GUTTER_WIDTH_PIXELS }}
    >
      {children}
    </div>
  )
}
