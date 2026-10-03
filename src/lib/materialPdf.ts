import html2pdf from 'html2pdf.js'
import logo from '../assets/logo_abacademy.png'

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
  return SKIPPED_PROPERTIES.has(property) || property.startsWith('min-') || property.startsWith('max-')
}

/**
 * Clona um elemento copiando os estilos computados (o que o navegador realmente
 * está exibindo) para o atributo style de cada nó. Assim o clone fica idêntico ao
 * original mesmo estando fora da árvore onde as regras de CSS foram definidas
 * (seletores como ".material-viewer .professor-material-rich-editor table").
 */
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

    if (sourceNode instanceof HTMLImageElement && target instanceof HTMLImageElement) {
      const renderedWidth = sourceNode.getBoundingClientRect().width
      if (renderedWidth > 0) target.style.width = `${renderedWidth}px`
      target.style.height = 'auto'
      target.style.maxWidth = '100%'
    }
  })

  return clone
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
        const response = await fetch(source)
        if (!response.ok) throw new Error('Imagem indisponível')

        const blob = await response.blob()
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

// A4 = 595.28 x 841.89 pt. Margens em pt: [topo, esquerda, base, direita].
// Largura útil = 595.28 - 36 - 36 = 523.28 pt ≈ 698 px (1 pt = 4/3 px), então a
// página é montada com 698 px de largura e o PDF sai em escala 1:1.
const PAGE_MARGIN_PT: [number, number, number, number] = [40, 36, 40, 36]
const PAGE_CONTENT_WIDTH_PX = 698

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
): Promise<Blob> {
  const page = document.createElement('article')
  page.style.width = `${PAGE_CONTENT_WIDTH_PX}px`
  page.style.boxSizing = 'border-box'
  page.style.padding = '0'
  page.style.margin = '0'
  page.style.background = '#ffffff'

  const headerClone = header ? cloneWithComputedStyles(header) : createDefaultHeader(language)
  headerClone.style.margin = headerClone.style.margin || '0 0 24px'
  headerClone.style.boxShadow = 'none'
  page.appendChild(headerClone)

  const body = cloneWithComputedStyles(source)
  body.removeAttribute('contenteditable')
  body.querySelectorAll('[contenteditable]').forEach((element) => {
    element.removeAttribute('contenteditable')
  })

  // O espaçamento externo vem das margens da página do PDF.
  body.style.width = '100%'
  body.style.margin = '0'
  body.style.padding = '0'
  body.style.border = '0'
  body.style.outline = 'none'
  body.style.boxShadow = 'none'
  body.style.background = 'transparent'

  // Evita cortar imagens e linhas de tabela no meio entre duas páginas.
  // Tabelas longas continuam podendo quebrar entre linhas.
  body.querySelectorAll<HTMLElement>('img, tr').forEach((element) => {
    element.style.breakInside = 'avoid'
    element.style.pageBreakInside = 'avoid'
  })

  page.appendChild(body)

  // O elemento precisa permanecer dentro da viewport para o html2canvas.
  // Não usamos display:none nem uma posição fora da área renderizada.
  page.style.position = 'fixed'
  page.style.left = '0'
  page.style.top = '0'
  page.style.zIndex = '-1'
  page.style.pointerEvents = 'none'
  document.body.appendChild(page)

  try {
    await inlineImages(page)
    await waitForImages(page)

    const worker = html2pdf()
      .set({
        margin: PAGE_MARGIN_PT,
        filename: title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.pdf',
        image: { type: 'jpeg', quality: 0.96 },
        enableLinks: true,
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        },
        jsPDF: {
          unit: 'pt',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: {
          mode: ['css'],
          // Parágrafos, títulos, itens de lista e citações não são cortados no meio de uma linha.
          avoid: ['img', 'tr', 'h1', 'h2', 'h3', 'p', 'li', 'blockquote'],
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
    page.remove()
  }
}
