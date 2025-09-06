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
    lineMake(1, 'Lines can be indented with Tab and de-dented with Shift-Tab'),
    lineMake(0, 'You can collapse a group of indented lines with Cmd-.'),
    lineMake(
      1,
      'Try it out by selecting the above line and then using the key binding'
    ),
    lineMake(0, 'In addition to key bindings, there are also slash commands'),
    lineMake(1, "Type /date at the end of this line to insert today's date."),
    lineMake(0, 'Trigger the command palette with Cmd-Shift-K'),
    lineMake(0, 'For more help, see the help section of the side panel'),
  ]
}
