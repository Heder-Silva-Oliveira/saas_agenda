import { Download, FileUp, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Modal } from '../../components/ui'
import { CSV_TEMPLATE, downloadCsv, parseClientsCsv } from '../../lib/csv'
import type { ClientImportRow, ImportResult } from '../../types'
import { api } from '../../services'

export function ImportClientsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: (result: ImportResult) => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ClientImportRow[]>([])
  const [errors, setErrors] = useState<{ line: number; message: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setFileName(null)
    setRows([])
    setErrors([])
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Selecione um arquivo .csv')
      return
    }
    const content = await file.text()
    const parsed = parseClientsCsv(content)
    setFileName(file.name)
    setRows(parsed.rows)
    setErrors(parsed.errors)
    setResult(null)
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setImporting(true)
    try {
      const imported = await api.clients.importMany(rows)
      setResult(imported)
      onImported(imported)
      if (imported.imported > 0) {
        toast.success(`${imported.imported} cliente(s) importado(s).`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível importar.',
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar clientes por CSV"
      description="Use o modelo para garantir as colunas corretas."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={importing}>
            Fechar
          </Button>
          <Button
            onClick={() => void handleImport()}
            loading={importing}
            disabled={rows.length === 0 || Boolean(result)}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Importar {rows.length > 0 ? `${rows.length} cliente(s)` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('modelo-clientes.csv', CSV_TEMPLATE)}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Baixar modelo CSV
          </Button>
          <span className="text-xs text-stone-500">
            Colunas: nome, telefone, email, data_nascimento, observacoes, tags,
            consentimento
          </span>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
          <FileUp className="mb-2 h-6 w-6 text-stone-400" />
          <span className="text-sm font-medium text-stone-700">
            {fileName ?? 'Selecionar arquivo CSV'}
          </span>
          <span className="mt-0.5 text-xs text-stone-500">
            O telefone deve conter DDD. Consentimento aceita sim/não.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
        </label>

        {fileName && (
          <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm">
            <p className="font-medium text-stone-800">
              {rows.length} linha(s) válida(s) encontrada(s)
            </p>
            {errors.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-rose-600">
                  {errors.length} linha(s) com problema:
                </p>
                {errors.slice(0, 5).map((error) => (
                  <p key={error.line} className="text-xs text-rose-600">
                    Linha {error.line}: {error.message}
                  </p>
                ))}
                {errors.length > 5 && (
                  <p className="text-xs text-stone-500">
                    E mais {errors.length - 5} problema(s).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 ring-1 ring-brand-200">
            <p className="font-semibold">Importação concluída</p>
            <p className="mt-0.5 text-xs">
              {result.imported} importado(s) · {result.skipped} ignorado(s)
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {result.errors.slice(0, 5).map((error) => (
                  <p key={`${error.line}-${error.message}`} className="text-xs text-rose-700">
                    Linha {error.line}: {error.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
