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
      className="bg-zinc-editor-main"
      color="zinc"
      badgeClassName="bg-zinc-editor-main"
    >
      <div className="w-4 h-4">{icon}</div>
      {children}
    </BadgeButton>
  )
}
