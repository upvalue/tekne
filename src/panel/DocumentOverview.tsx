import { generateTableOfContents, type TableOfContentsItem } from '@/docs/table-of-contents';
import { Aggregate } from './Aggregate';
import { useAtomValue, useSetAtom } from 'jotai';
import { docAtom, focusedLineAtom } from '@/editor/state';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { scrollToLine } from '@/editor/navigation';

export const TOCContent = ({ content }: { content: string }) => {
    // Strip leading # 
    const strippedContent = content.replace(/^#+ /, '');

    return <div>
        <span className="text-sm">{strippedContent}</span>
    </div>
}

export const TOCItem = ({ item }: { item: TableOfContentsItem }) => {
    const setFocusedLine = useSetAtom(focusedLineAtom);

    return <div
        style={{ paddingLeft: `${item.indentLevel * 12}px` }}
        className={cn(item.isActive ? 'font-bold' : '', 'cursor-pointer')}
        onClick={() => {
            setFocusedLine(item.lineIdx)
            scrollToLine(item.lineIdx)
        }}
    >
        <TOCContent content={item.content} />
    </div>
}


export const TableOfContents = ({ toc }: { toc: TableOfContentsItem[] }) => {
    return <div className="px-4">
        {toc.map((item) => <TOCItem key={item.lineIdx} item={item} />)}
    </div>
}

export const DocumentOverviewSection = ({ label, children }: { label: string, children: React.ReactNode }) => {
    const [collapsed, setCollapsed] = useState(false);

    return <div className={`flex flex-col gap-4 p-4`}>
        <div className="flex text-lg items-center gap-2 bg-zinc-800 p-2 rounded-md cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
            <ChevronDownIcon className={`w-4 h-4 ${collapsed ? 'rotate-180' : ''}`} onClick={() => setCollapsed(!collapsed)} />
            <h2 className="text-lg font-bold">{label}</h2>
        </div>
        <div className={`${collapsed ? 'hidden' : ''}`}>
            {children}
        </div>
    </div>
}

export const DocumentOverview = () => {
    const doc = useAtomValue(docAtom);
    const focusedLineIdx = useAtomValue(focusedLineAtom);
    const toc = generateTableOfContents(doc.children, focusedLineIdx ?? undefined);
    return <div>
        {toc.length > 0 && (
            <DocumentOverviewSection label="Table of Contents">
                <TableOfContents toc={toc} />
            </DocumentOverviewSection>
        )}
        <DocumentOverviewSection label="Aggregate">
            <Aggregate />
        </DocumentOverviewSection>
    </div>
}