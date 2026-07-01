import type { EleitorComCabo } from './types'
import { formatDataHora } from './format'

// O 'xlsx' é pesado (~450KB). Carrega sob demanda, só quando o usuário exporta,
// para não pesar o bundle inicial da Planilha.
const carregarXLSX = () => import('xlsx')

/** Converte a lista de eleitores em linhas planas para exportação. */
function toRows(eleitores: EleitorComCabo[]) {
  return eleitores.map((e) => ({
    Nome: e.nome,
    Telefone: e.telefone,
    'Local de votação': e.local_votacao,
    Zona: e.zona,
    Seção: e.secao,
    Bairro: e.bairro,
    Cidade: e.cidade,
    'Data de Nascimento': e.data_nascimento ?? '',
    'Indicação (Cabo)': e.cabo?.nome ?? '',
    Status: e.status,
    Observações: e.observacoes ?? '',
    'Cadastrado em': formatDataHora(e.created_at),
  }))
}

export async function exportarXLSX(eleitores: EleitorComCabo[]) {
  const XLSX = await carregarXLSX()
  const ws = XLSX.utils.json_to_sheet(toRows(eleitores))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Eleitores')
  XLSX.writeFile(wb, `eleitores-${hoje()}.xlsx`)
}

export async function exportarCSV(eleitores: EleitorComCabo[]) {
  const XLSX = await carregarXLSX()
  const ws = XLSX.utils.json_to_sheet(toRows(eleitores))
  const csv = XLSX.utils.sheet_to_csv(ws)
  // BOM para acentuação correta no Excel
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  baixar(blob, `eleitores-${hoje()}.csv`)
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
