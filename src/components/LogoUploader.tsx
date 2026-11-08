import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../services'
import { Avatar, Button } from './ui'

export function LogoUploader({
  value,
  name,
  onChange,
}: {
  value: string | null
  name: string
  onChange: (url: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Envie um arquivo de imagem (PNG, JPG ou WEBP).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2 MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const url = await api.business.uploadLogo(file)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || 'Negócio'} src={value} size="lg" />
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
            leftIcon={
              uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />
            }
          >
            {value ? 'Trocar logo' : 'Enviar logo'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-stone-500">PNG, JPG ou WEBP · até 2 MB</p>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
