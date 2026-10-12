import { Button as ButtonPrimitive } from '@base-ui/react/button'
import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { TouchTarget } from './Button'
import { Link } from './Link'

const colors = {
  red: 'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:bg-accent-fill/10 dark:text-accent dark:group-hover:bg-accent-fill/20',
  orange:
    'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:bg-accent-fill/10 dark:text-accent dark:group-hover:bg-accent-fill/20',
  amber:
    'bg-accent/20 text-accent-fill group-hover:bg-accent/30 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/15',
  yellow:
    'bg-accent/20 text-accent-fill group-hover:bg-accent/30 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/15',
  lime: 'bg-accent/20 text-accent-fill group-hover:bg-accent/30 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/15',
  green:
    'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:bg-accent-fill/10 dark:text-accent dark:group-hover:bg-accent-fill/20',
  emerald:
    'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:bg-accent-fill/10 dark:text-accent dark:group-hover:bg-accent-fill/20',
  teal: 'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:bg-accent-fill/10 dark:text-accent dark:group-hover:bg-accent-fill/20',
  cyan: 'bg-accent/20 text-accent-fill group-hover:bg-accent/30 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/15',
  sky: 'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:bg-accent-fill/10 dark:text-accent dark:group-hover:bg-accent-fill/20',
  blue: 'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:text-accent dark:group-hover:bg-accent-fill/25',
  indigo:
    'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:text-accent dark:group-hover:bg-accent-fill/20',
  violet:
    'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:text-accent dark:group-hover:bg-accent-fill/20',
  purple:
    'bg-accent-fill/15 text-accent-fill group-hover:bg-accent-fill/25 dark:text-accent dark:group-hover:bg-accent-fill/20',
  fuchsia:
    'bg-accent/15 text-accent-fill group-hover:bg-accent/25 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/20',
  pink: 'bg-accent/15 text-accent-fill group-hover:bg-accent/25 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/20',
  rose: 'bg-accent/15 text-accent-fill group-hover:bg-accent/25 dark:bg-accent/10 dark:text-accent dark:group-hover:bg-accent/20',
  zinc: 'bg-muted/10 text-raised group-hover:bg-muted/20 dark:bg-white/5 dark:text-text-2 dark:group-hover:bg-white/10',
  none: '',
}

type BadgeProps = { color?: keyof typeof colors }

export function Badge({
  color = 'zinc',
  className,
  ...props
}: BadgeProps & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...props}
      className={clsx(
        'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline',
        colors[color],
        className
      )}
    />
  )
}

export const BadgeButton = forwardRef(function BadgeButton(
  {
    color = 'zinc',
    className,
    children,
    badgeClassName,
    ...props
  }: BadgeProps & {
    className?: string
    children: React.ReactNode
    badgeClassName?: string
  } & (
      | Omit<ButtonPrimitive.Props, 'className'>
      | Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>
    ),
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = clsx(
    className,
    'group relative inline-flex rounded-md focus:not-focus-visible:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fill cursor-pointer'
  )

  return 'href' in props ? (
    <Link
      {...props}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLAnchorElement>}
    >
      <TouchTarget>
        <Badge color={color} className={badgeClassName}>
          {children}
        </Badge>
      </TouchTarget>
    </Link>
  ) : (
    <ButtonPrimitive {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Badge color={color} className={badgeClassName}>
          {children}
        </Badge>
      </TouchTarget>
    </ButtonPrimitive>
  )
})
