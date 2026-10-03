import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Loader2, X } from 'lucide-react'

export type MaterialRecord = {
  id: string
  titulo: string
  idioma: 'ingles' | 'alemao' | null
  conteudo_html: string
  imagens: string[]
  videos: string[]
  status: 'rascunho' | 'publicado'
  created_at: string
  updated_at: string
  publicado_em: string | null
  pdf_publicado_path?: string | null
  pdf_publicado_em?: string | null
}

type Props = {
  material: MaterialRecord
  pdfUrl?: string
  onClose?: () => void
}

export default function MaterialViewer({ material, pdfUrl, onClose }: Props) {
  const [loading, setLoading] = useState(Boolean(pdfUrl))
  const language = material.idioma === 'ingles'
    ? 'Inglês'
    : material.idioma === 'alemao'
      ? 'Alemão'
      : 'Material de apoio'

  useEffect(() => {
    if (pdfUrl) setLoading(false)
  }, [pdfUrl])

  return (
    <div className="material-viewer">
      <div className="material-viewer-toolbar no-print">
        {onClose && (
          <button type="button" className="material-viewer-back" onClick={onClose}>
            <ArrowLeft size={18} /> Voltar
          </button>
        )}

        <div className="material-viewer-actions">
          {pdfUrl && (
            <a
              className="material-viewer-download"
              href={pdfUrl}
              download
            >
              <Download size={17} /> Baixar PDF
            </a>
          )}

          {onClose && (
            <button type="button" className="material-viewer-close" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <article className="material-document material-pdf-document">
        <header className="student-material-pdf-toolbar material-document-header">
          <div>
            <span>AB ACADEMY IDIOMAS</span>
            <strong>{material.titulo}</strong>
            <small>{language}</small>
          </div>
        </header>

        {loading && (
          <div className="material-pdf-loading student-empty-state">
            <Loader2 size={24} className="student-spin" />
            <span>Carregando material...</span>
          </div>
        )}

        {!loading && pdfUrl ? (
          <iframe
            className="student-material-pdf-frame material-pdf-frame"
            src={pdfUrl}
            title={material.titulo}
          />
        ) : !loading ? (
          <div className="material-pdf-empty student-empty-state">
            <strong>PDF indisponível</strong>
            <span>Este material ainda não possui uma publicação em PDF.</span>
          </div>
        ) : null}
      </article>
    </div>
  )
}
