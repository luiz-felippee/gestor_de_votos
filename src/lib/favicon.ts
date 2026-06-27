export function updateFavicon(url: string | null) {
  const link = document.getElementById('favicon') as HTMLLinkElement | null
  if (!link) return

  if (url) {
    link.href = url
    link.type = 'image/png' // a foto costuma ser png/jpeg
  } else {
    link.href = '/favicon.svg'
    link.type = 'image/svg+xml'
  }
}
