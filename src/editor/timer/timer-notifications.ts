import { appPath } from '@/lib/app-path'
import { isMobile } from '@/lib/platform'

const TAG = 'tekne-active-timer'
let registrationPromise: Promise<ServiceWorkerRegistration> | undefined
let generation = 0
let pending = Promise.resolve()

export const supportsTimerNotifications = () =>
  isMobile &&
  window.isSecureContext &&
  'Notification' in window &&
  'serviceWorker' in navigator

const getRegistration = () => {
  registrationPromise ??= navigator.serviceWorker
    .register(appPath('/timer-notifications-sw.js'), {
      scope: appPath('/'),
      updateViaCache: 'none',
    })
    .then(async (registration) => {
      if (registration.active) return registration
      const worker = registration.installing ?? registration.waiting
      if (!worker) throw new Error('Notification worker did not start')
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => finish(new Error('Notification setup timed out')),
          10_000
        )
        const finish = (error?: Error) => {
          clearTimeout(timeout)
          worker.removeEventListener('statechange', check)
          if (error) reject(error)
          else resolve()
        }
        const check = () => {
          if (worker.state === 'activated') finish()
          if (worker.state === 'redundant')
            finish(new Error('Notification setup failed'))
        }
        worker.addEventListener('statechange', check)
        check()
      })
      return registration
    })
    .catch((error) => {
      registrationPromise = undefined
      throw error
    })
  return registrationPromise
}

/** Call directly from a tap so the browser can show its permission prompt. */
export const enableTimerNotifications = async () => {
  if (!supportsTimerNotifications()) return 'denied' as const
  const permission = await Notification.requestPermission()
  if (permission === 'granted') await getRegistration()
  return permission
}

export const showTimerStartedNotification = (
  line: string,
  startedAt: number
) => {
  if (!supportsTimerNotifications() || Notification.permission !== 'granted')
    return
  const currentGeneration = ++generation
  const url = window.location.href
  pending = pending
    .then(async () => {
      const registration = await getRegistration()
      if (currentGeneration !== generation) return
      await registration.showNotification('Timer started', {
        body: `${line}\nStarted at ${new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Tap to return to Tekne.`,
        icon: appPath('/favicon/tekne-app-192.png'),
        tag: TAG,
        data: { url },
        silent: true,
      })
    })
    .catch((error) => console.error('Timer notification failed', error))
  return pending
}

/** Serialize cleanup after display, including a display still awaiting setup. */
export const dismissTimerNotification = () => {
  generation++
  if (!registrationPromise) return
  pending = pending
    .then(async () => {
      const registration = await registrationPromise
      const notifications = await registration?.getNotifications({ tag: TAG })
      notifications?.forEach((notification) => notification.close())
    })
    .catch((error) => console.error('Timer notification cleanup failed', error))
  return pending
}
