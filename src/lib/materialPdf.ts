import html2pdf from 'html2pdf.js'
import logo from '../assets/logo_abacademy.png'
import { supabase } from './supabase'

// Propriedades que dependem do tamanho do contêiner de origem e que NÃO devem ser
// congeladas ao copiar os estilos computados (a largura do PDF é diferente da tela).
const SKIPPED_PROPERTIES = new Set([
  'width',
  'height',
  'inline-size',
  'block-size',
  'left',
  'right',
  'top',
  'bottom',
  'inset',
  'inset-inline',
  'inset-block',
  'inset-inline-start',
  'inset-inline-end',
  'inset-block-start',
  'inset-block-end',
  'perspective-origin',
  'transform-origin',
])

function shouldSkipProperty(property: string) {
  return (
    SKIPPED_PROPERTIES.has(property) ||
    property.startsWith('min-') ||
    property.startsWith('max-') ||
    // Animações e transições reiniciariam no clone (ex.: fade-in começando em opacity 0),
    // fazendo o conteúdo ser capturado invisível.
    property.startsWith('animation') ||
    property.startsWith('transition')
  )
}

/**
 * Clona um elemento copiando os estilos computados (o que o navegador realmente
 * está exibindo) para o atributo style de cada nó. Assim o clone fica idêntico ao
 * original mesmo estando fora da árvore onde as regras de CSS foram definidas
 * (seletores como ".material-viewer .professor-material-rich-editor table").
 */
function clonePseudoElement(source: HTMLElement, pseudo: '::before' | '::after') {
  const computed = window.getComputedStyle(source, pseudo)
  const content = computed.getPropertyValue('content')
  if (!content || content === 'none' || content === 'normal') return null

  const pseudoElement = document.createElement('span')
  pseudoElement.setAttribute('aria-hidden', 'true')

  for (let i = 0; i < computed.length; i += 1) {
    const property = computed[i]
    if (property.startsWith('animation') || property.startsWith('transition')) continue
    pseudoElement.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    )
  }

  pseudoElement.style.width = computed.getPropertyValue('width')
  pseudoElement.style.height = computed.getPropertyValue('height')
  pseudoElement.style.maxWidth = 'none'
  pseudoElement.style.maxHeight = 'none'
  pseudoElement.style.minWidth = '0'
  pseudoElement.style.minHeight = '0'
  pseudoElement.style.animation = 'none'
  pseudoElement.style.transition = 'none'

  return pseudoElement
}

function cloneWithComputedStyles(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]

  sourceNodes.forEach((sourceNode, index) => {
    const target = cloneNodes[index]
    if (!target) return

    const computed = window.getComputedStyle(sourceNode)
    for (let i = 0; i < computed.length; i += 1) {
      const property = computed[i]
      if (shouldSkipProperty(property)) continue
      target.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property))
    }

    target.style.animation = 'none'
    target.style.transition = 'none'

    const before = clonePseudoElement(sourceNode, '::before')
    const after = clonePseudoElement(sourceNode, '::after')
    if (before) target.prepend(before)
    if (after) target.appendChild(after)

    if (sourceNode instanceof HTMLImageElement && target instanceof HTMLImageElement) {
      const renderedWidth = sourceNode.getBoundingClientRect().width
      if (renderedWidth > 0) target.style.width = `${renderedWidth}px`
      target.style.height = 'auto'
      target.style.maxWidth = '100%'
    }
  })

  return clone
}

// Garante que a raiz do clone fique no fluxo normal da página e visível.
// Um clone com position:fixed/sticky (comum em cabeçalhos e barras) sai do fluxo e
// faz o contêiner do html2pdf ficar com altura zero, gerando PDF em branco.
function normalizeRoot(element: HTMLElement) {
  element.style.position = 'static'
  element.style.transform = 'none'
  element.style.opacity = '1'
  element.style.visibility = 'visible'
  element.style.display = element.style.display === 'none' ? 'block' : element.style.display
  element.style.boxShadow = 'none'
  element.style.outline = 'none'
}

// Cabeçalho padrão (logo + título), usado quando nenhum cabeçalho é informado,
// por exemplo na publicação gerada a partir do editor.
function createDefaultHeader(language: string) {
  const header = document.createElement('header')
  header.style.cssText =
    'display:flex;align-items:center;gap:16px;padding:0 0 16px;margin:0 0 24px;border-bottom:1px solid #e2e8f0;'

  const image = document.createElement('img')
  image.src = logo
  image.alt = 'AB Academy Idiomas'
  image.style.cssText = 'height:48px;width:auto;'

  const title = document.createElement('strong')
  title.textContent = `AB ACADEMY IDIOMAS - ${(language || 'Material de apoio').toUpperCase()}`
  title.style.cssText = 'font-size:16px;font-weight:700;color:#172033;'

  header.append(image, title)
  return header
}

function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'))
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve()
            return
          }

          const finish = () => {
            image.removeEventListener('load', finish)
            image.removeEventListener('error', finish)
            resolve()
          }

          image.addEventListener('load', finish)
          image.addEventListener('error', finish)
        }),
    ),
  )
}

async function inlineImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'))

  await Promise.all(
    images.map(async (image) => {
      const source = image.getAttribute('src')?.trim()
      if (!source || source.startsWith('data:')) return

      try {
        const materialPath = image.getAttribute('data-material-image')?.trim()
        let blob: Blob

        if (materialPath) {
          const { data, error } = await supabase.storage.from('materiais').download(materialPath)
          if (error || !data) throw error || new Error('Imagem indisponível')
          blob = data
        } else {
          const response = await fetch(source)
          if (!response.ok) throw new Error('Imagem indisponível')
          blob = await response.blob()
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })

        image.setAttribute('src', dataUrl)
      } catch {
        throw new Error(`Não foi possível incorporar a imagem "${image.alt || 'anexada'}" ao PDF.`)
      }

    }),
  )
}

// A4 = 595.28 x 841.89 pt. A largura útil é calculada a partir das margens do PDF,
// mantendo a proporção CSS de 96 DPI usada pelo html2canvas.
const PAGE_MARGIN_PT: [number, number, number, number] = [40, 36, 40, 36]
const PAGE_CONTENT_WIDTH_PX = Math.round((595.28 - PAGE_MARGIN_PT[1] - PAGE_MARGIN_PT[3]) * (96 / 72))

// Navegadores limitam o tamanho de um canvas (altura ~16-32 mil px, área ~16 milhões de px
// no Safari/iOS). Acima disso o canvas sai em branco. A escala é reduzida para documentos longos.
const MAX_CANVAS_PIXELS = 4_000_000
const MAX_CANVAS_SIDE = 4_096

function pickScale(contentHeightPx: number) {
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (PAGE_CONTENT_WIDTH_PX * Math.max(contentHeightPx, 1)))
  const bySide = MAX_CANVAS_SIDE / Math.max(contentHeightPx, 1)
  return Math.max(0.25, Math.min(2, byArea, bySide))
}

/**
 * Gera o PDF de um material.
 * @param source  elemento com o conteúdo (visualizador ou editor)
 * @param header  cabeçalho opcional (ex.: o cabeçalho exibido no visualizador).
 *                Sem ele, é criado o cabeçalho padrão com logo e idioma.
 */
export async function generateMaterialPdf(
  title: string,
  language: string,
  source: HTMLElement,
  header?: HTMLElement | null,
  visualDocument?: HTMLElement | null,
): Promise<Blob> {
  // A página fica em fluxo normal (sem position:fixed), porque o html2pdf clona este
  // elemento para dentro do próprio contêiner. Para ela existir no layout (largura e
  // altura medidas) sem aparecer na tela, é colocada dentro de um palco invisível.
  const stage = document.createElement('div')
  stage.setAttribute('aria-hidden', 'true')
  stage.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;'

  const page = document.createElement('article')
  page.style.width = `${PAGE_CONTENT_WIDTH_PX}px`
  page.style.boxSizing = 'border-box'
  page.style.padding = '0'
  page.style.margin = '0'
  page.style.background = '#ffffff'

  if (visualDocument) {
    const documentClone = cloneWithComputedStyles(visualDocument)
    normalizeRoot(documentClone)
    documentClone.removeAttribute('contenteditable')
    documentClone.querySelectorAll('[contenteditable]').forEach((element) => {
      element.removeAttribute('contenteditable')
    })

    // O PDF nasce do mesmo <article> exibido no visualizador, preservando
    // a hierarquia, o cabeçalho, as imagens, as classes e os estilos computados.
    documentClone.style.width = '100%'
    documentClone.style.boxSizing = 'border-box'
    documentClone.style.margin = '0'
    documentClone.style.maxWidth = 'none'
    documentClone.style.overflow = 'visible'

    // O editor visual é uma folha A4 para edição, portanto seus estilos de tela
    // (min-height, padding e margem externa) não podem ser reaplicados como uma
    // segunda página dentro do A4 do PDF. Mantemos apenas um espaçamento interno
    // compacto para separar o conteúdo do cabeçalho sem consumir outra folha.
    const editorClone = documentClone.querySelector<HTMLElement>('.professor-material-rich-editor')
    if (editorClone) {
      editorClone.style.width = '100%'
      editorClone.style.minHeight = '0'
      editorClone.style.height = 'auto'
      editorClone.style.margin = '0'
      editorClone.style.padding = '28px 36px 32px'
      editorClone.style.border = '0'
      editorClone.style.borderRadius = '0'
      editorClone.style.boxShadow = 'none'
      editorClone.style.overflow = 'visible'
    }

    documentClone.querySelectorAll<HTMLElement>('img, tr').forEach((element) => {
      element.style.breakInside = 'avoid'
      element.style.pageBreakInside = 'avoid'
    })

    page.appendChild(documentClone)
  } else {
    const headerClone = header ? cloneWithComputedStyles(header) : createDefaultHeader(language)
    normalizeRoot(headerClone)
    headerClone.style.width = '100%'
    headerClone.style.boxSizing = 'border-box'
    headerClone.style.marginTop = '0'
    headerClone.style.marginLeft = '0'
    headerClone.style.marginRight = '0'
    headerClone.style.marginBottom = headerClone.style.marginBottom || '24px'
    page.appendChild(headerClone)

    const body = cloneWithComputedStyles(source)
    body.removeAttribute('contenteditable')
    body.querySelectorAll('[contenteditable]').forEach((element) => {
      element.removeAttribute('contenteditable')
    })
    normalizeRoot(body)

    // O espaçamento externo vem das margens da página do PDF.
    body.style.width = '100%'
    body.style.boxSizing = 'border-box'
    body.style.margin = '0'
    body.style.padding = '0'
    body.style.border = '0'
    body.style.background = 'transparent'
    body.style.overflow = 'visible'

    body.querySelectorAll<HTMLElement>('img, tr').forEach((element) => {
      element.style.breakInside = 'avoid'
      element.style.pageBreakInside = 'avoid'
    })

    page.appendChild(body)
  }
  stage.appendChild(page)
  document.body.appendChild(stage)

  try {
    await inlineImages(page)
    await waitForImages(page)

    const contentHeight = page.scrollHeight
    if (contentHeight < 10) {
      throw new Error('Não foi possível medir o conteúdo do material para gerar o PDF.')
    }

    const worker = html2pdf()
      .set({
        margin: PAGE_MARGIN_PT,
        filename: title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.pdf',
        image: { type: 'jpeg', quality: 0.96 },
        enableLinks: true,
        html2canvas: {
          scale: pickScale(contentHeight),
          width: PAGE_CONTENT_WIDTH_PX,
          height: contentHeight,
          windowWidth: PAGE_CONTENT_WIDTH_PX,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          // Evita captura deslocada (PDF em branco) quando a página ou o modal está rolado.
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: {
          unit: 'pt',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: {
          mode: ['css'],
          avoid: ['img', 'tr'],
        },
      })
      .from(page)
      .toContainer()
      .toCanvas()
      .toPdf()

    const blob = await worker.outputPdf('blob')
    if (!(blob instanceof Blob)) {
      throw new Error('A geração do PDF não retornou um arquivo válido.')
    }

    return blob
  } finally {
    stage.remove()
  }
}
