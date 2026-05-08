self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {}
  const number = data.number ?? '?'

  event.waitUntil(
    self.registration.showNotification('포켓몬카드샵', {
      body: `손님번호 #${number} — 점포로 와주세요!`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'catchtable-call',
      data: { number },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const number = event.notification.data?.number
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = list.find(c => c.url.includes('/wait/') || c.url.includes('/called/'))
      if (target) {
        target.navigate(`/called/${number}`)
        return target.focus()
      }
      return clients.openWindow(`/called/${number}`)
    })
  )
})
