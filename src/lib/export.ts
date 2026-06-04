import * as XLSX from 'xlsx'
import type { EleitorComCabo } from './types'
import { formatDataHora } from './format'

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
    'Indicação (Cabo)': e.cabo?.nome ?? '',
    Status: e.status,
    Observações: e.observacoes ?? '',
    'Cadastrado em': formatDataHora(e.created_at),
  }))
}

export function exportarXLSX(eleitores: EleitorComCabo[]) {
  const ws = XLSX.utils.json_to_sheet(toRows(eleitores))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Eleitores')
  XLSX.writeFile(wb, `eleitores-${hoje()}.xlsx`)
}

export function exportarCSV(eleitores: EleitorComCabo[]) {
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
