import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Loader2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo_abacademy.png'
import { resolveMaterialImage } from '../lib/materialImageCache'
import { generateMaterialPdf } from '../lib/materialPdf'

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

function extractMaterialImagePaths(html: string, fallbackPaths: string[]) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  return Array.from(
    new Set([
      ...fallbackPaths,
      ...Array.from(wrapper.querySelectorAll('img'), (image) =>
        image.getAttribute('data-material-image')?.trim() ||
        image.getAttribute('src')?.match(/^{{MATERIAL_IMAGE:(.+)}}$/)?.[1]?.trim() ||
        '',
      ),
    ].filter(Boolean)),
  )
}

async function hydrateMaterialHtml(html: string, fallbackPaths: string[]) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html

  const paths = extractMaterialImagePaths(html, fallbackPaths)
  if (!paths.length) return wrapper.innerHTML

  const entries = await Promise.all(
    paths.map(async (path) => {
      const url = await resolveMaterialImage(path, async () => {
        const { data, error } = await supabase.storage
          .from('materiais')
          .createSignedUrl(path, 3600)

        if (error) throw error
        return data?.signedUrl || null
      })

      return [path, url || ''] as const
    }),
  )

  const urls = Object.fromEntries(entries)

  wrapper.querySelectorAll('img').forEach((image) => {
    const rawSource = image.getAttribute('src')?.trim() || ''
    const path =
      image.getAttribute('data-material-image')?.trim() ||
      rawSource.match(/^{{MATERIAL_IMAGE:(.+)}}$/)?.[1]?.trim()

    if (!path) return

    const url = urls[path]
    if (!url) return

    image.setAttribute('src', url)
    image.setAttribute('data-material-image', path)
    image.style.maxWidth = '100%'
    image.style.height = 'auto'
  })

  return wrapper.innerHTML
}

async function downloadPdfDirect(sourceHtml: string, title: string) {
  const source = document.createElement('div')
  source.innerHTML = sourceHtml

  const pdfBlob = await generateMaterialPdf(title, '', source)
  if (pdfBlob.size < 1024) {
    throw new Error('O PDF gerado está vazio ou inválido.')
  }

  const objectUrl = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'material'}.pdf`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}


export default function MaterialViewer({ material, pdfUrl, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [contentHtml, setContentHtml] = useState('')
  const [contentError, setContentError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const language = material.idioma === 'ingles'
    ? 'Inglês'
    : material.idioma === 'alemao'
      ? 'Alemão'
      : 'Material de apoio'

  useEffect(() => {
    let mounted = true

    async function loadContent() {
      setLoading(true)
      setContentError('')

      try {
        const html = await hydrateMaterialHtml(
          material.conteudo_html || '<p></p>',
          material.imagens || [],
        )

        if (!mounted) return
        setContentHtml(html)
      } catch (error) {
        if (!mounted) return
        setContentError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as imagens do material.',
        )
        setContentHtml(material.conteudo_html || '<p></p>')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadContent()

    return () => {
      mounted = false
    }
  }, [material.id, material.conteudo_html, material.imagens])

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
            <button
              type="button"
              className="material-viewer-download"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true)
                setContentError('')

                try {
                  await downloadPdfDirect(contentHtml, material.titulo)
                } catch (error) {
                  setContentError(
                    error instanceof Error
                      ? error.message
                      : 'Não foi possível baixar o PDF.',
                  )
                } finally {
                  setDownloading(false)
                }
              }}
            >
              <Download size={17} /> {downloading ? 'Baixando...' : 'Baixar PDF'}
            </button>
          )}

          {onClose && (
            <button type="button" className="material-viewer-close" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <article className="material-document material-html-document">
        <header className="student-material-pdf-toolbar material-document-header">
          <img className="material-document-logo" src={logo} alt="AB Academy Idiomas" />
          <div className="material-document-title">
            <strong>AB ACADEMY IDIOMAS - {language.toUpperCase()}</strong>
          </div>
        </header>

        {loading ? (
          <div className="material-pdf-loading student-empty-state">
            <Loader2 size={24} className="student-spin" />
            <span>Carregando material...</span>
          </div>
        ) : (
          <>
            {contentError && (
              <div className="material-viewer-content-error" role="status">
                {contentError}
              </div>
            )}

            <div
              className="material-viewer-content professor-material-rich-editor"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </>
        )}
      </article>
    </div>
  )
}
