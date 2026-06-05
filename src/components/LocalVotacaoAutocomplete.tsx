import { useState, useEffect, useRef } from 'react'

interface NominatimResult {
  place_id: number
  name: string
  display_name: string
  class: string
  type: string
  address: {
    amenity?: string
    road?: string
    quarter?: string
    suburb?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
  }
}

interface Props {
  value: string
  onChangeLocal: (val: string) => void
  onSelectAddress: (bairro: string, cidade: string) => void
  className?: string
}

export function LocalVotacaoAutocomplete({ value, onChangeLocal, onSelectAddress, className }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Sincroniza o valor inicial ou reset do pai
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Fecha a lista se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounce para a busca na API
  useEffect(() => {
    // Se o valor digitado for exatamente o valor que o form já tem, significa que não foi o usuário digitando busca
    if (!query || query === value || query.length < 4) {
      setResults([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true)
      try {
        // Filtra para "Escola [nome] Pernambuco" para maior precisão, mas se o usuário já digitou Pernambuco, não repete.
        const termo = query.toLowerCase().includes('pernambuco') ? query : `${query} Pernambuco`
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(termo)}&format=json&addressdetails=1&countrycodes=br&limit=5`
        
        const res = await fetch(url, {
          headers: { 'User-Agent': 'GestorDeVotos/1.0' }
        })
        const data = await res.json()
        setResults(data)
        setIsOpen(data.length > 0)
      } catch (err) {
        console.error('Erro ao buscar local no OpenStreetMap:', err)
      } finally {
        setLoading(false)
      }
    }, 600) // 600ms de debounce

    return () => clearTimeout(delayDebounce)
  }, [query, value])

  const handleSelect = (item: NominatimResult) => {
    // Tenta pegar o nome mais limpo da escola
    const nomeLocal = item.address.amenity || item.name || item.display_name.split(',')[0]
    
    // Tenta pegar o bairro de várias chaves possíveis do OSM
    const bairroLocal = item.address.quarter || item.address.suburb || ''
    
    // Tenta pegar a cidade
    const cidadeLocal = item.address.city || item.address.town || item.address.village || item.address.municipality || ''

    setQuery(nomeLocal)
    onChangeLocal(nomeLocal)
    onSelectAddress(bairroLocal, cidadeLocal)
    setIsOpen(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChangeLocal(val)
    setIsOpen(true)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (results.length > 0) setIsOpen(true) }}
        className={className}
        placeholder="Digite para buscar a escola..."
        autoComplete="off"
      />
      
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {results.map((item) => {
            const isSchool = item.class === 'amenity' && (item.type === 'school' || item.type === 'college')
            return (
              <li
                key={item.place_id}
                onClick={() => handleSelect(item)}
                className="cursor-pointer border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{isSchool ? '🏫' : '📍'}</span>
                  <div>
                    <strong className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {item.address.amenity || item.name || item.display_name.split(',')[0]}
                    </strong>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.display_name}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
