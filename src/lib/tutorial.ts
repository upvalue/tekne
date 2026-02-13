import { lineMake } from '@/docs/schema'

export const makeTutorial = () => {
  let i = 0
  const now = Date.now()
  const lines = [
    lineMake(i, '# Welcome to Tekne!'),
    lineMake(++i, 'Try clicking on this line to edit it.'),
    lineMake(--i, '# Editing basics'),
    lineMake(
      ++i,
      'Tekne is a freestyle productivity application in the shape of an outline editor.'
    ),
    lineMake(i, 'You can navigate lines by using the up and down arrow keys.'),
    lineMake(i, 'You can insert a new line by pressing the enter key'),
    lineMake(
      ++i,
      'Lines can be indented with `Tab` and de-dented with `Shift-Tab`'
    ),
    lineMake(--i, 'You can collapse a group of indented lines with `Cmd-.`'),
    lineMake(
      ++i,
      'Try it out by selecting the above line and then using the key binding'
    ),
    lineMake(--i, 'In addition to key bindings, there are also slash commands'),
    lineMake(
      ++i,
      "Type `/date` at the end of this line to insert today's date."
    ),
    lineMake(--i, 'A subset of Markdown syntax is supported'),
    lineMake(
      ++i,
      'Like _italic_, **bold**, ~~strikethrough~~, and `inline code`'
    ),
    lineMake(
      i,
      'As well as [links](https://example.com) (click this line to see the syntax)'
    ),
    lineMake(
      --i,
      'You can link to [[NewDocuments]] within Tekne, and click to navigate to them'
    ),
    lineMake(
      ++i,
      'Try clicking NewDocument and then navigating back with the browser'
    ),
    lineMake(--i, '## Headings'),
    lineMake(
      ++i,
      'You can add #, ## and ### at the beginning of a line to make headings'
    ),
    lineMake(
      i,
      "Headings are also normal lines; they make navigating within a large document easier but aren't otherwise meaningful"
    ),
    lineMake((i = 0), '# Data in documents'),
    lineMake(++i, 'You can attach data like timers and tasks to lines'),
    lineMake(++i, 'This line is a task', {
      datumTaskStatus: 'incomplete',
    }),
    lineMake(i, 'This line is a timer', {
      datumTimeSeconds: 0,
    }),
    lineMake(i, 'Try clicking on the widgets to see what they do'),
    lineMake(i, 'Use slash commands like `/timer` and `/task` to add data'),
    lineMake(--i, 'You can #tag sections of your documents'),
    lineMake(
      ++i,
      'When you add data (like tasks or timers) to tagged sections, you can see what the data looks like over time'
    ),
    lineMake(
      i,
      'Try updating this timer and waiting a little bit to see the data appear in the aggregate view',
      {
        datumTimeSeconds: 0,
      }
    ),
    lineMake((i = 0), '# Navigation'),
    lineMake(++i, 'You can open or create documents with `Cmd-O`'),
    lineMake(i, 'You can search across all documents with `Cmd-/`'),
    lineMake(i, 'And trigger a command palette with `Cmd-K`'),
    lineMake(i, 'For more help, see the help section of the side panel'),
    lineMake(
      i,
      'A good place to start is by opening the command palette and typing daily to create a daily note'
    ),
  ]
  return lines.map((line, idx) => {
    const ts = new Date(now + idx).toISOString()
    return { ...line, timeCreated: ts, timeUpdated: ts }
  })
}
