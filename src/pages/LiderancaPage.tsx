import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Target, Flame, CalendarDays, Users2, MapPin, Landmark, Globe2, CheckCircle2, MessageCircle, Link as LinkIcon, QrCode, Download } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { resolverFotoUrl } from '../lib/fotoUrl'
import { generateSlug } from '../lib/format'
import { CIDADES } from '../lib/constants'
import { NOMES_REGIOES, regiaoDoMunicipio } from '../data/regioesPE'
import { useMapaPontos } from '../hooks/useMapaPontos'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { MapaEstrategico } from '../components/MapaEstrategico'
import { RankingComTendencia } from '../components/RankingComTendencia'

type Escopo = 'municipio' | 'regiao' | 'pe'

/**
 * Painel pessoal da liderança: meu progresso + meu link de indicação + ranking
 * geral (com tendência) + mapa, filtráveis por Município / Região / Pernambuco
 * inteiro. No desktop o ranking fica fixo na lateral (não empurra o resto pra
 * baixo); no mobile empilha, com o ranking por último.
 */
export function LiderancaPage() {
  const { usuario } = useAuth()

  const [escopo, setEscopo] = useState<Escopo>('pe')
  const [valor, setValor] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mostrarQR, setMostrarQR] = useState(false)

  const { data: painel, isLoading: carregandoPainel } = useQuery({
    queryKey: ['lideranca-meu-painel'],
    queryFn: () => api.getMeuPainel(),
  })

  // Pré-seleciona a própria cidade/região da liderança assim que o painel carrega,
  // em vez de abrir sempre no estado "Pernambuco inteiro" (mais relevante pra ela).
  useEffect(() => {
    if (painel?.cidade && escopo === 'pe' && valor === null) {
      setEscopo('municipio')
      setValor(painel.cidade)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painel?.cidade])

  const { data: rankingResp, isLoading: carregandoRanking } = useQuery({
    queryKey: ['lideranca-ranking', escopo, valor],
    queryFn: () => api.getRankingLiderancas(escopo, valor),
  })

  // Mapa: busca todos os pontos/estatísticas da campanha uma vez e filtra no
  // cliente pelo escopo escolhido — evita precisar de mais um endpoint no backend
  // (o próprio hook já é cacheado pelo react-query, então trocar de escopo é instantâneo).
  const { pontos: todosPontos } = useMapaPontos()
  const { stats } = useDashboardStats()

  const dentroDoEscopo = useMemo(() => {
    return (cidade: string | null) => {
      if (escopo === 'pe' || !valor) return true
      if (!cidade) return false
      if (escopo === 'municipio') return cidade === valor
      if (escopo === 'regiao') return regiaoDoMunicipio(cidade) === valor
      return true
    }
  }, [escopo, valor])

  const pontosFiltrados = useMemo(
    () => todosPontos.filter((p) => dentroDoEscopo(p.cidade)),
    [todosPontos, dentroDoEscopo],
  )
  const statsFiltrados = useMemo(
    () => (stats ? stats.porCidade.filter((c) => dentroDoEscopo(c.label)) : []),
    [stats, dentroDoEscopo],
  )

  const meuItem = rankingResp?.ranking.find((r) => r.voce)
  const progresso = painel ? Math.min(100, Math.round((painel.total_equipe / Math.max(1, painel.meta_eleitores)) * 100)) : 0

  // Link de indicação — mesmo formato que o admin gera pro cabo em /cabos
  // (dominio.com/c/campanha/nome-da-lideranca), só que a própria liderança
  // já vê o dela pronto aqui, sem precisar pedir pro admin.
  const nomeParaSlug = (painel?.nome ?? usuario?.nome ?? '').trim()
  const nomeCandidato = painel?.candidato_nome ?? usuario?.campanha_nome ?? null
  const linkIndicacao = nomeParaSlug && usuario?.campanha_slug
    ? `${window.location.origin}/c/${usuario.campanha_slug}/${generateSlug(nomeParaSlug)}`
    : null
  const qrId = 'qr-lideranca'

  async function copiarLink() {
    if (!linkIndicacao) return
    const numeroTexto = painel?.numero_urna ? ` (nº ${painel.numero_urna})` : ''
    const mensagem = `Faça seu cadastro comigo, ${nomeParaSlug.split(' ')[0]}, e apoie *${nomeCandidato || 'nossa campanha'}${numeroTexto}*!\n\nAcesse o link:\n${linkIndicacao}`
    try {
      await navigator.clipboard.writeText(mensagem)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    } catch {
      /* clipboard indisponível — o link já está visível na tela pra copiar na mão */
    }
  }

  function baixarQR() {
    const canvas = document.getElementById(qrId) as HTMLCanvasElement | null
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qrcode-${generateSlug(nomeParaSlug || 'lideranca')}.png`
    a.click()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 animate-fade-in">
      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        {/* ===================== Coluna principal ===================== */}
        <div className="lg:col-span-2">
          {/* Cabeçalho pessoal */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md dark:border-slate-800">
              <img
                src={resolverFotoUrl(painel?.foto_url, `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario?.nome ?? 'U')}&background=random`)!}
                alt={painel?.nome ?? ''}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">
                Olá, {(painel?.nome ?? usuario?.nome ?? '').split(' ')[0]} 👋
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {painel?.eh_lider && painel.tamanho_equipe > 0
                  ? `Liderança · ${painel.tamanho_equipe} multiplicador${painel.tamanho_equipe > 1 ? 'es' : ''}`
                  : 'Cabo eleitoral'}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                <Target className="h-4 w-4 text-brand-500" /> Sua meta
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-white">
                {painel?.total_equipe ?? 0} <span className="font-medium text-slate-400">/ {painel?.meta_eleitores ?? 0}</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-700"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {progresso >= 100
                ? '🎉 Meta batida! Manda ver pra continuar subindo no ranking.'
                : `${progresso}% da meta — faltam ${Math.max(0, (painel?.meta_eleitores ?? 0) - (painel?.total_equipe ?? 0))} cadastros.`}
            </p>
          </div>

          {/* Cards de números */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <CardNumero icon={<CalendarDays className="h-4 w-4" />} label="Hoje" valor={painel?.cadastros_hoje} />
            <CardNumero icon={<Flame className="h-4 w-4" />} label="Esta semana" valor={painel?.cadastros_semana} />
            <CardNumero icon={<Users2 className="h-4 w-4" />} label="Total" valor={painel?.total_equipe} />
          </div>

          {/* Minha posição no ranking (destaque) */}
          {meuItem && (
            <div className="mt-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-indigo-50 p-4 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-indigo-500/10">
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                Você está em <span className="text-brand-600 dark:text-brand-400">{meuItem.posicao}º lugar</span> no ranking
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {meuItem.tendencia === 'subiu' && `📈 Subiu ${meuItem.delta} posiç${meuItem.delta > 1 ? 'ões' : 'ão'} esta semana! Continue assim.`}
                {meuItem.tendencia === 'desceu' && `📉 Caiu ${meuItem.delta} posiç${meuItem.delta > 1 ? 'ões' : 'ão'} esta semana — bora recuperar!`}
                {meuItem.tendencia === 'manteve' && 'Sua posição se manteve esta semana.'}
              </p>
            </div>
          )}

          {/* Meu link de indicação */}
          {linkIndicacao && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                <LinkIcon className="h-4 w-4 text-brand-500" /> Seu link de cadastro
              </p>

              {/* Quem é o candidato/número e quem é a liderança — pra ficar claro
                  em qualquer print/QR que circule sem o resto da tela junto. */}
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                {nomeCandidato && (
                  <span className="rounded-full bg-brand-50 px-3 py-1 font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    {nomeCandidato}{painel?.numero_urna ? ` · Nº ${painel.numero_urna}` : ''}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Liderança: {painel?.nome ?? usuario?.nome}
                </span>
              </div>

              <p className="mb-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {linkIndicacao}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={copiarLink}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  {linkCopiado ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  {linkCopiado ? 'Copiado!' : 'Copiar para o WhatsApp'}
                </button>
                <button
                  onClick={() => setMostrarQR((v) => !v)}
                  className={`flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 transition active:scale-[0.98] ${
                    mostrarQR
                      ? 'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-400 dark:ring-brand-500/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                  title="Mostrar QR Code"
                  aria-label="Mostrar QR Code"
                >
                  <QrCode className="h-4 w-4" />
                </button>
              </div>

              {mostrarQR && (
                <div className="mt-4 flex animate-fade-in flex-col items-center gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-inner dark:border-slate-800/80 dark:bg-slate-950">
                  <div className="rounded-xl border border-slate-100 p-2 shadow-sm dark:border-slate-800">
                    <QRCodeCanvas id={qrId} value={linkIndicacao} size={160} includeMargin />
                  </div>
                  <button
                    onClick={baixarQR}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar PNG
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Gráfico de evolução (14 dias) */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Seu ritmo (últimos 14 dias)</p>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={painel?.evolucao ?? []} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="data"
                    tickFormatter={(d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)}
                    tick={{ fontSize: 10 }}
                    interval={2}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(d) => String(d).split('-').reverse().join('/')}
                    formatter={(v) => [v as number, 'cadastros']}
                  />
                  <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seletor de escopo */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
            <BotaoEscopo ativo={escopo === 'municipio'} onClick={() => { setEscopo('municipio'); setValor(painel?.cidade ?? CIDADES[0]) }} icon={<MapPin className="h-3.5 w-3.5" />}>
              Município
            </BotaoEscopo>
            <BotaoEscopo ativo={escopo === 'regiao'} onClick={() => { setEscopo('regiao'); setValor(regiaoDoMunicipio(painel?.cidade) ?? NOMES_REGIOES[0]) }} icon={<Landmark className="h-3.5 w-3.5" />}>
              Região
            </BotaoEscopo>
            <BotaoEscopo ativo={escopo === 'pe'} onClick={() => { setEscopo('pe'); setValor(null) }} icon={<Globe2 className="h-3.5 w-3.5" />}>
              Pernambuco
            </BotaoEscopo>
          </div>

          {escopo === 'municipio' && (
            <select
              value={valor ?? ''}
              onChange={(e) => setValor(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {escopo === 'regiao' && (
            <select
              value={valor ?? ''}
              onChange={(e) => setValor(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {NOMES_REGIOES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          {/* Mapa filtrado pelo escopo */}
          <div className="mt-4">
            <MapaEstrategico
              pontosGeo={pontosFiltrados}
              statsPorCidade={statsFiltrados}
              cidadeSelecionada={escopo === 'municipio' ? valor : null}
              onCidadeSelect={() => {}}
              modoVisualizacao="calor"
              height="320px"
            />
          </div>

          {carregandoPainel && (
            <p className="mt-4 text-center text-xs text-slate-400">Carregando seus dados...</p>
          )}
        </div>

        {/* ===================== Ranking (lateral no desktop) ===================== */}
        {/* Painel próprio (borda/fundo/sombra, igual aos outros cards) em vez da lista
            "solta" de antes — sem isso a barra de rolagem ficava colada direto no
            texto dos itens, sem nenhum respiro. Título fica FORA da área que rola
            (border-b separando), só a lista rola por dentro do card. */}
        <div className="mt-6 lg:sticky lg:top-20 lg:mt-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
              <span className="text-lg leading-none">🏆</span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold text-slate-800 dark:text-white">Ranking geral</h2>
                <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
                  {escopo !== 'pe' && valor ? valor : 'Pernambuco'}
                </p>
              </div>
            </div>
            <div className="p-3 lg:overflow-y-auto">
              {carregandoRanking ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                </div>
              ) : (
                <RankingComTendencia ranking={rankingResp?.ranking ?? []} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CardNumero({ icon, label, valor }: { icon: React.ReactNode; label: string; valor?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        {icon}
      </div>
      <p className="text-lg font-black text-slate-800 dark:text-white">{valor ?? 0}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  )
}

function BotaoEscopo({ ativo, onClick, icon, children }: { ativo: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
        ativo
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
