import { lineMake } from '@/editor/schema'

export const makeTutorial = () => {
  return [
    lineMake(0, 'Welcome to Tekne! Try clicking on this line to edit it.'),
    lineMake(
      0,
      'Tekne is a freestyle productivity application in the shape of an outline editor.'
    ),
    lineMake(0, 'You can navigate lines by using the up and down arrow keys.'),
    lineMake(0, 'You can insert a new line by pressing the enter key'),
    lineMake(
      1,
      'Lines can be indented with `Tab` and de-dented with `Shift-Tab`'
    ),
    lineMake(0, 'You can collapse a group of indented lines with `Cmd-.`'),
    lineMake(
      1,
      'Try it out by selecting the above line and then using the key binding'
    ),
    lineMake(0, 'In addition to key bindings, there are also slash commands'),
    lineMake(1, "Type `/date` at the end of this line to insert today's date."),
    lineMake(0, 'A subset of Markdown syntax is supported'),
    lineMake(
      1,
      'Like _italic_, **bold**, ~~strikethrough~~, and `inline code`'
    ),
    lineMake(
      1,
      'As well as [links](https://example.com) (click this line to see the syntax)'
    ),
    lineMake(
      0,
      'You can link to [[NewDocuments]] within Tekne, and click to navigate to them'
    ),
    lineMake(
      1,
      'Try clicking NewDocument and then navigating back with the browser'
    ),
    lineMake(0, 'You can attach data like timers and tasks to lines'),
    lineMake(1, 'This line is a task', {
      datumTaskStatus: 'incomplete',
    }),
    lineMake(1, 'This line is a timer', {
      datumTimeSeconds: 0,
    }),
    lineMake(1, 'Try clicking on them to see what they do'),
    lineMake(1, 'Use slash commands like `/timer` and `/task` to add data'),
    lineMake(0, 'You can #tag sections of your documents'),
    lineMake(
      1,
      'When you add data (like tasks or timers) to tagged sections, you can see what the data looks like over time'
    ),
    lineMake(
      1,
      'Try updating this timer and waiting a little bit to see the data appear in the aggregate view',
      {
        datumTimeSeconds: 0,
      }
    ),
    lineMake(0, 'You can open or create documents with `Cmd-K'),
    lineMake(0, 'And trigger a command palette with `Cmd-Shift-K`'),
    lineMake(0, 'For more help, see the help section of the side panel'),
    lineMake(
      0,
      'A good place to start is by opening the command palette and typing daily to create a daily note'
    ),
  ]
}
