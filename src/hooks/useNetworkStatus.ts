import { useState, useEffect } from 'react'

export function useNetworkStatus() {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    // navigator.connection is non-standard but widely supported on Chromium/Android
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    
    if (conn) {
      const updateConnectionStatus = () => {
        // Slow if saveData is true or effectiveType is 2g/3g
        const slow = conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType)
        setIsSlow(slow)
      }

      updateConnectionStatus()
      conn.addEventListener('change', updateConnectionStatus)
      
      return () => {
        conn.removeEventListener('change', updateConnectionStatus)
      }
    }
  }, [])

  return { isSlow }
}
