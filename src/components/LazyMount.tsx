import { useState, useEffect, useRef, type ReactNode } from 'react'

interface LazyMountProps {
  children: ReactNode
  fallback?: ReactNode
  rootMargin?: string
  className?: string
}

export function LazyMount({ children, fallback, rootMargin = '200px', className = '' }: LazyMountProps) {
  const [isIntersecting, setIntersecting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Se o observer já disparou uma vez, não precisamos mais dele
    if (isIntersecting) return

    const el = ref.current
    if (!el) return

    // Fallback: Se o browser não suportar IntersectionObserver, carrega na hora
    if (!('IntersectionObserver' in window)) {
      setIntersecting(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isIntersecting, rootMargin])

  return (
    <div ref={ref} className={`contents ${className}`}>
      {isIntersecting ? children : fallback}
    </div>
  )
}
