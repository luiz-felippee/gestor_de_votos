import { useState, useRef } from 'react'
import { UploadCloud, FileType2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { api } from '../lib/api'

// 'xlsx' é pesado (~450KB): carrega sob demanda, só ao selecionar/importar arquivo.
const carregarXLSX = () => import('xlsx')

interface ImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setError(null)
    setPreview([])

    try {
      const XLSX = await carregarXLSX()
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      setPreview(jsonData.slice(0, 3)) // Mostra os 3 primeiros para preview
    } catch (err) {
      setError('Erro ao ler o arquivo. Certifique-se que é um Excel ou CSV válido.')
    }
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    
    try {
      const XLSX = await carregarXLSX()
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      // raw: false faz com que datas/telefones sejam lidos como strings limpas
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false })

      // Mapeamento super flexível de colunas
      const eleitoresParaEnviar = jsonData.map((row: any) => {
        // Encontra chaves ignorando case e espaços
        const findKey = (keywords: string[]) => {
          const key = Object.keys(row).find(k => 
            keywords.some(kw => k.toLowerCase().trim().includes(kw))
          )
          return key ? row[key] : undefined
        }

        return {
          nome: findKey(['nome', 'eleitor']),
          telefone: findKey(['tel', 'cel', 'fone', 'whatsapp']),
          bairro: findKey(['bairro']),
          cidade: findKey(['cidade', 'municipio']),
          local_votacao: findKey(['local', 'escola', 'colegio']),
          zona: findKey(['zona']),
          secao: findKey(['seca', 'seção']), // trata seção/seca
          cpf: findKey(['cpf']),
          titulo_eleitor: findKey(['titulo', 'título']),
          data_nascimento: findKey(['nascimento', 'data']),
          observacoes: findKey(['obs']),
        }
      })

      const response = await api.importarEleitores(eleitoresParaEnviar)
      setSuccessMsg(`${response.inserted} eleitores importados de um total de ${response.totalSent} encontrados na planilha (duplicados ignorados).`)
      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Erro na importação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-6 pb-8 sm:pb-6 shadow-xl dark:bg-slate-900 border-t border-slate-200 sm:border dark:border-slate-800 relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Alça do Bottom Sheet (Mobile) */}
        <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mb-6 sm:hidden" />
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileType2 className="h-6 w-6 text-brand-500" />
            Importar Planilha
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Envie um arquivo Excel (.xlsx) ou CSV. Garantimos que eleitores duplicados não serão recriados.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}

        {!successMsg && (
          <>
            <div 
              className="mt-2 flex justify-center rounded-xl border border-dashed border-slate-300 px-6 py-10 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-400 dark:hover:bg-brand-900/20 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                <div className="mt-4 flex text-sm leading-6 text-slate-600 dark:text-slate-400">
                  <span className="relative cursor-pointer rounded-md font-semibold text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2 hover:text-brand-500 dark:text-brand-400">
                    Clique para selecionar um arquivo
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-500">.XLSX, .XLS, ou .CSV até 10MB</p>
              </div>
            </div>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              className="hidden" 
              onChange={handleFileChange} 
            />

            {file && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80%]">
                  {file.name}
                </span>
                <span className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {preview.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pré-visualização (3 primeiras linhas)</p>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        {Object.keys(preview[0]).slice(0, 4).map(key => (
                          <th key={key} className="px-3 py-2 text-left font-medium text-slate-500">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).slice(0, 4).map((val: any, j) => (
                            <td key={j} className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Processando...
                  </>
                ) : (
                  <>Importar Eleitores</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
