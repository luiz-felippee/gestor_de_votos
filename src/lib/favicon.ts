export function updateFavicon(url: string | null) {
  const link = document.getElementById('favicon') as HTMLLinkElement | null
  if (!link) return

  if (url) {
    link.href = url
    // Data URLs (base64) já contêm o MIME type; URLs normais costumam ser png/jpeg
    link.type = url.startsWith('data:image/webp') ? 'image/webp' : 'image/png'
  } else {
    link.href = '/favicon.svg'
    link.type = 'image/svg+xml'
  }
}
