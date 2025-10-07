let mainTitle: string | null = null
let detailTitle: string | null = null
let timerActive = false

const formatTitle = (main: string | null, detail: string | null, isTimerActive: boolean) => {
  const parts = []
  if (detail) parts.push(detail)
  if (main) parts.push(main)
  parts.push('tekne')
  const title = parts.join(' / ')
  return isTimerActive ? `⏱️ ${title}` : title
}

const updateTitle = () => {
  const formattedTitle = formatTitle(mainTitle, detailTitle, timerActive)
  document.title = formattedTitle
}

export const setDetailTitle = (title: string | null) => {
  detailTitle = title
  updateTitle()
}

export const setMainTitle = (title: string | null) => {
  mainTitle = title
  updateTitle()
}

export const setTimerActive = (active: boolean) => {
  timerActive = active
  updateTitle()
}
