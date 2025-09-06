let mainTitle: string | null = null
let detailTitle: string | null = null

const formatTitle = (main: string | null, detail: string | null) => {
  const parts = []
  if (detail) parts.push(detail)
  if (main) parts.push(main)
  parts.push('tekne')
  return parts.join(' / ')
}

const updateTitle = () => {
  const formattedTitle = formatTitle(mainTitle, detailTitle)
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
