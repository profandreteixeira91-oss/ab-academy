import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, Loader2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { resolveMaterialImage } from '../lib/materialImageCache'
import { generateMaterialPdf } from '../lib/materialPdf'
import { sanitizeMaterialHtml } from '../lib/sanitizeMaterialHtml'
import '../styles/material-pdf-minimal.css'

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
  /** Mantido apenas por compatibilidade. O download não depende mais dele. */
  pdfUrl?: string
  /** Exibe o botão "Baixar PDF". Por padrão, sempre que o material estiver carregado. */
  allowDownload?: boolean
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
      const url = await resolveMaterialImage(
        path,
        async () => {
          const { data, error } = await supabase.storage
            .from('materiais')
            .createSignedUrl(path, 3600)

          if (error) throw error
          return data?.signedUrl || null
        },
        async () => {
          const { data, error } = await supabase.storage
            .from('materiais')
            .download(path)

          if (error) throw error
          return data || null
        },
      )

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

// Garante que todas as imagens do conteúdo visível terminaram de carregar antes de gerar o PDF.
// Se alguma falhar, o download é interrompido com erro claro, em vez de gerar um PDF
// diferente do que aparece na tela.
async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return

      const path = image.getAttribute('data-material-image')?.trim()
      if (path) {
        try {
          const { data, error } = await supabase.storage.from('materiais').download(path)
          if (!error && data) {
            const objectUrl = URL.createObjectURL(data)
            image.src = objectUrl
            await new Promise<void>((resolve) => {
              if (image.complete && image.naturalWidth > 0) {
                resolve()
                return
              }
              const done = () => {
                image.removeEventListener('load', done)
                image.removeEventListener('error', done)
                resolve()
              }
              image.addEventListener('load', done)
              image.addEventListener('error', done)
            })
            return
          }
        } catch {
          // A validação final abaixo mantém a proteção contra PDFs divergentes.
        }
      }

      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 15000)
        const done = () => {
          window.clearTimeout(timer)
          image.removeEventListener('load', done)
          image.removeEventListener('error', done)
          resolve()
        }
        image.addEventListener('load', done)
        image.addEventListener('error', done)
      })
    }),
  )

  const failed = images.filter((image) => !image.complete || image.naturalWidth === 0)
  if (failed.length) {
    throw new Error(
      `${failed.length} imagem(ns) do material não carregaram. O PDF não foi gerado para não ficar diferente do que aparece na tela. Tente novamente.`,
    )
  }
}

// Gera o PDF a partir do MESMO elemento que está sendo exibido no visualizador
// (mesmo HTML, mesmas classes de estilo, mesmo idioma no cabeçalho) e dispara o download.
export default function MaterialViewer({ material, allowDownload = true, onClose }: Props) {
  const documentRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [loading, setLoading] = useState(true)
  const [contentHtml, setContentHtml] = useState('')
  const [contentError, setContentError] = useState('')
  
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
        setContentHtml(sanitizeMaterialHtml(html))
      } catch (error) {
        if (!mounted) return
        setContentError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as imagens do material.',
        )
        setContentHtml(sanitizeMaterialHtml(material.conteudo_html || '<p></p>'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadContent()

    return () => {
      mounted = false
    }
  }, [material.id, material.conteudo_html, material.imagens])

  useEffect(() => {
    if (loading || !contentRef.current) return

    let cancelled = false
    const objectUrls: string[] = []

    async function hydrateVisibleImages() {
      const images = Array.from(contentRef.current?.querySelectorAll('img[data-material-image]') || [])

      await Promise.all(
        images.map(async (image) => {
          const path = image.getAttribute('data-material-image')?.trim()
          if (!path) return

          if (image.complete && image.naturalWidth > 0) return

          try {
            const { data, error } = await supabase.storage
              .from('materiais')
              .download(path)

            if (cancelled || error || !data) return

            const objectUrl = URL.createObjectURL(data)
            objectUrls.push(objectUrl)
            image.src = objectUrl
            image.style.maxWidth = '100%'
            image.style.height = 'auto'
          } catch {
            // A imagem permanece sem alteração caso o Storage não esteja acessível.
          }
        }),
      )
    }

    void hydrateVisibleImages()

    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [loading, contentHtml])



  return (
    <div className="material-viewer">
      <div className="material-viewer-toolbar no-print">
        {onClose && (
          <button type="button" className="material-viewer-back" onClick={onClose}>
            <ArrowLeft size={18} /> Voltar
          </button>
        )}

        <div className="material-viewer-actions">
          {allowDownload && !loading && pdfUrl && (
            <a
              className="material-viewer-download"
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={17} /> Visualizar PDF
            </a>
          )}

          {onClose && (
            <button type="button" className="material-viewer-close" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <article ref={documentRef} className="material-document material-html-document">
        <header ref={headerRef} className="student-material-pdf-toolbar material-document-header">
          <div className="material-document-brand" aria-label="AB Academy Idiomas">
            <img
              className="material-document-logo"
              src="/favicon.svg"
              alt="AB Academy Idiomas"
            />
          </div>
          <div className="material-document-cover">
            <span>AB ACADEMY IDIOMAS</span>
            <strong>{language.toUpperCase()}</strong>
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
              ref={contentRef}
              className="material-viewer-content professor-material-rich-editor"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </>
        )}
      </article>
    </div>
  )
}
