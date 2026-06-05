import { useMemo, useState } from 'react'
import { useEleitores } from '../hooks/useEleitores'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'

export function MapaCalorPage() {
  const { eleitores, loading } = useEleitores()

  const { treeData, bairrosList } = useMemo(() => {
    // Agrupa por cidade e depois por bairro
    const cidadesMap = new Map<string, Map<string, number>>()

    for (const e of eleitores) {
      if (!e.cidade || !e.bairro) continue
      if (!cidadesMap.has(e.cidade)) cidadesMap.set(e.cidade, new Map())
      const bairroMap = cidadesMap.get(e.cidade)!
      bairroMap.set(e.bairro, (bairroMap.get(e.bairro) || 0) + 1)
    }

    const treeData = []
    const bairrosList: { cidade: string; bairro: string; count: number }[] = []

    for (const [cidade, bairroMap] of cidadesMap.entries()) {
      const children = []
      for (const [bairro, count] of bairroMap.entries()) {
        children.push({ name: bairro, size: count })
        bairrosList.push({ cidade, bairro, count })
      }
      treeData.push({
        name: cidade,
        children: children.sort((a, b) => b.size - a.size)
      })
    }

    bairrosList.sort((a, b) => b.count - a.count)

    return { treeData, bairrosList }
  }, [eleitores])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-slate-500">Carregando dados do mapa...</p>
      </div>
    )
  }

  const maxCount = bairrosList.length > 0 ? bairrosList[0].count : 1

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Mapa de Força 🗺️
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          Descubra visualmente as regiões e bairros com maior concentração de eleitores cadastrados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Treemap Gráfico */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col min-h-[500px]">
          <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">Visão Geral (Treemap)</h2>
          <div className="flex-1 w-full h-full min-h-[400px]">
            {treeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treeData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  fill="#8b5cf6"
                  content={<CustomizedContent />}
                >
                  <Tooltip content={<CustomTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-slate-200 rounded-xl dark:border-slate-800">
                <p className="text-slate-400">Nenhum dado com cidade e bairro informado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Lista Térmica */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
          <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">Lista Térmica</h2>
          <p className="text-xs text-slate-500 mb-4 dark:text-slate-400">Ranking dos bairros mais quentes da campanha.</p>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {bairrosList.length > 0 ? (
              bairrosList.map((item, i) => {
                const pct = Math.max(0, Math.min(100, (item.count / maxCount) * 100))
                // Interpola a opacidade do background baseado na porcentagem para criar o efeito termal (vermelho)
                const bgOpacity = 0.1 + (pct * 0.9) / 100
                
                return (
                  <div key={`${item.cidade}-${item.bairro}`} className="relative flex items-center justify-between p-3 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800">
                    {/* Fundo térmico */}
                    <div 
                      className="absolute inset-0 bg-red-500 dark:bg-red-600 pointer-events-none transition-opacity" 
                      style={{ opacity: bgOpacity }} 
                    />
                    
                    <div className="relative z-10">
                      <p className={`font-bold text-sm ${pct > 60 ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.bairro}
                      </p>
                      <p className={`text-xs font-medium ${pct > 60 ? 'text-red-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {item.cidade}
                      </p>
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-end">
                      <span className={`text-lg font-black ${pct > 60 ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>
                        {item.count}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold ${pct > 60 ? 'text-red-100' : 'text-slate-400'}`}>
                        votos
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-400 text-center mt-10">Nenhum bairro cadastrado.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// Custom tooltip para o Treemap
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-slate-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl border border-slate-700">
        <p className="font-bold">{data.name}</p>
        <p className="text-slate-300">{data.size} eleitor(es)</p>
      </div>
    )
  }
  return null
}

// Custom Content para renderizar o nome dentro dos retângulos
const CustomizedContent = (props: any) => {
  const { root, depth, x, y, width, height, index, payload, name } = props

  // Renderiza apenas as "folhas" (bairros), não a raiz
  if (depth !== 1) return null
  
  // Cores dinâmicas para o treemap baseadas no index para dar variação
  const colors = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981']
  const color = colors[index % colors.length]

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 50 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 5}
          textAnchor="middle"
          fill="#fff"
          fontSize={width > 80 ? 14 : 10}
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      )}
    </g>
  )
}
