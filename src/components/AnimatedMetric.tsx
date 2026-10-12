import { useLayoutEffect, useRef } from 'react'

/** Only the current value is exposed to assistive technology. */
export const AnimatedMetric = ({ value }: { value: string }) => {
  const current = useRef<HTMLSpanElement>(null)
  const outgoing = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)

  useLayoutEffect(() => {
    const before = previous.current
    previous.current = value
    const element = current.current
    const old = outgoing.current
    if (!element || !old || before === value || !element.animate) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    old.textContent = before
    old.style.visibility = 'visible'
    const options = { duration: 180, easing: 'ease-out' }
    const incoming = element.animate(
      [
        { transform: 'translateY(0.6em)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      options
    )
    const leaving = old.animate(
      [
        { transform: 'translateY(0)', opacity: 1 },
        { transform: 'translateY(-0.6em)', opacity: 0 },
      ],
      options
    )
    const stop = () => {
      incoming.cancel()
      leaving.cancel()
      old.style.visibility = 'hidden'
    }
    leaving.onfinish = stop
    preference.addEventListener('change', stop)
    return () => {
      stop()
      preference.removeEventListener('change', stop)
    }
  }, [value])

  return (
    <span className="relative inline-block overflow-hidden align-bottom tabular-nums">
      <span
        ref={outgoing}
        aria-hidden="true"
        className="invisible absolute left-0 top-0 whitespace-nowrap"
      />
      <span ref={current} className="inline-block">
        {value}
      </span>
    </span>
  )
}
