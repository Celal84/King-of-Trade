export function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    o.start()
    o.stop(ctx.currentTime + 0.8)
  } catch {
    /* ses desteklenmiyor */
  }
}

export async function askNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
}

export function browserNotify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: './icon.svg' })
}

export async function telegram(token: string, chat: string, text: string): Promise<boolean> {
  if (!token || !chat) return false
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${encodeURIComponent(chat)}&text=${encodeURIComponent(text)}`)
  return r.ok
}
