export type VerticalRange = {
  top: number
  bottom: number
}

/**
 * The smallest scroll offset that places a target inside a visible range.
 * Positive values scroll down; negative values scroll up.
 */
export const scrollDeltaToReveal = (
  target: VerticalRange,
  visible: VerticalRange,
  margin = 12
): number => {
  const visibleTop = visible.top + margin
  const visibleBottom = visible.bottom - margin

  if (target.top < visibleTop) return target.top - visibleTop
  if (target.bottom > visibleBottom) return target.bottom - visibleBottom
  return 0
}
