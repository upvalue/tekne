import { Badge, BadgeButton } from './vendor/Badge'

export const IconBadge = ({
  icon,
  children,
  ...props
}: {
  icon: React.ReactNode
  children?: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof Badge>) => {
  return (
    <BadgeButton
      {...props}
      className="dark:bg-zinc-900"
      color="zinc"
      badgeClassName="dark:bg-zinc-900"
    >
      <div className="w-4 h-4">{icon}</div>
      {children}
    </BadgeButton>
  )
}
