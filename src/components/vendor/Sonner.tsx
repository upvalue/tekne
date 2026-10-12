import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group "
      style={
        {
          '--normal-bg': 'var(--color-raised)',
          '--normal-text': 'var(--color-text)',
          '--normal-border': 'transparent',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
