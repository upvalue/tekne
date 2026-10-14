export const scrollToLine = (lineIdx: number) => {
  const line = document.querySelector(`[data-line-idx="${lineIdx}"]`)
  if (line) {
    line.scrollIntoView({ behavior: 'smooth' })
  }
}
