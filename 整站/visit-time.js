'use strict'

window.MiYaBiVisitTime = (() => {
 const endpoint = document.querySelector('meta[name="miyabi-visit-endpoint"]')?.content
 if (!endpoint) return { enter() {} }

 let view = null
 let since = null
 const pending = new Map()

 function count(now) {
  if (since === null) return
  const ms = Math.floor(now - since)
  if (ms > 0) pending.set(view, (pending.get(view) ?? 0) + ms)
 }

 function flush() {
  if (!pending.size) return
  const body = JSON.stringify({ times: [...pending] })
  pending.clear()
  fetch(endpoint, { method: 'POST', body, credentials: 'omit', keepalive: true }).catch(() => {})
 }

 function pause() {
  count(performance.now())
  since = null
  flush()
 }

 function resume() {
  if (since === null && view !== null && document.visibilityState === 'visible') since = performance.now()
 }

 document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resume()
  else pause()
 })
 window.addEventListener('pagehide', pause)
 window.addEventListener('pageshow', resume)
 window.setInterval(() => {
  if (since !== null && document.visibilityState === 'visible') {
   const now = performance.now()
   count(now)
   since = now
  }
  flush()
 }, 15000)

 return {
  enter(index) {
   if (view === index) return
   count(performance.now())
   since = null
   view = index
   resume()
  }
 }
})()
