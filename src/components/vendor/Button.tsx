import { Button as ButtonPrimitive } from '@base-ui/react/button'
import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { Link } from './Link'

type ButtonProps = (
  | { color?: string; outline?: never; plain?: never }
  | { color?: never; outline: true; plain?: never }
  | { color?: never; outline?: never; plain: true }
) & { className?: string; children: React.ReactNode } & (
    | Omit<ButtonPrimitive.Props, 'className'>
    | Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>
  )

export const Button = forwardRef(function Button(
  { color, outline, plain, className, children, ...props }: ButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = clsx(
    'relative inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:opacity-50',
    outline || plain || !color
      ? 'bg-white/5 text-text-2 hover:bg-white/9 hover:text-text'
      : 'bg-mark text-text hover:brightness-125',
    className
  )

  return 'href' in props ? (
    <Link
      {...props}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLAnchorElement>}
    >
      <TouchTarget>{children}</TouchTarget>
    </Link>
  ) : (
    <ButtonPrimitive {...props} className={classes} ref={ref}>
      <TouchTarget>{children}</TouchTarget>
    </ButtonPrimitive>
  )
})

/**
 * Expand the hit area to at least 44×44px on touch devices
 */
export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  )
}
