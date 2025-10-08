import { GUTTER_WIDTH_PIXELS } from "@/editor/constants"

/**
* Pads a non editor page (like the not found document) to look like te editor
*/
const NonEditorLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className={`flex flex-col h-full space-y-4 px-[${GUTTER_WIDTH_PIXELS}px] py-4`}>
            {children}
        </div>
    )
}

export default NonEditorLayout