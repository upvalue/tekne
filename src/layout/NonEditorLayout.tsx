/**
 * Pads a non editor page (like the not found document) to look like the
 * editor. 162px matches GUTTER_WIDTH_PIXELS in editor/constants.ts; it's a
 * literal here so Tailwind's static extractor can see the class.
 */
export const NonEditorLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div className="flex flex-col h-full space-y-4 py-4 px-4 md:px-[162px]">
      {children}
    </div>
  )
}
