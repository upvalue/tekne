interface EditorLayoutProps {
  editor: React.ReactNode
  sidepanel: React.ReactNode
}

export function EditorLayout({ editor, sidepanel }: EditorLayoutProps) {
  return (
    <div className="w-full flex flex-col ">
      <div className="flex flex-grow ">
        <div className="w-[60%] Editor">{editor}</div>
        <div className="w-[40%] Panel">{sidepanel}</div>
      </div>
    </div>
  )
}
