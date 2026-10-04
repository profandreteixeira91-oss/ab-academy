const PAGE_ATTR = 'data-material-page'
const PAGE_HEADER_ATTR = 'data-material-page-header'

export const MATERIAL_PAGE_CLASS = 'material-editor-a4-page'

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123
const PAGE_GAP = 28

const LANGUAGE_LABELS: Record<string, string> = {
  ingles: 'INGLÊS',
  alemao: 'ALEMÃO',
}

function getLanguageLabel(editor: HTMLElement) {
  const language = editor.dataset.materialLanguage || ''
  return LANGUAGE_LABELS[language] || 'MATERIAL DE APOIO'
}

function isPage(element: Node): element is HTMLElement {
  return element instanceof HTMLElement && element.hasAttribute(PAGE_ATTR)
}

function isPageHeader(node: Node) {
  return node instanceof HTMLElement && node.hasAttribute(PAGE_HEADER_ATTR)
}

function getLogicalNodes(editor: HTMLElement) {
  const pages = Array.from(editor.children).filter(isPage)
  if (!pages.length) return Array.from(editor.childNodes)

  return pages.flatMap((page) =>
    Array.from(page.childNodes).filter((node) => !isPageHeader(node)),
  )
}

function createPageHeader(editor: HTMLElement) {
  const header = document.createElement('header')
  header.className = 'material-document-header'
  header.setAttribute(PAGE_HEADER_ATTR, 'true')
  header.setAttribute('contenteditable', 'false')
  header.setAttribute('aria-hidden', 'true')

  const brand = document.createElement('div')
  brand.className = 'material-document-brand'

  const logo = document.createElement('img')
  logo.className = 'material-document-logo'
  logo.src = '/favicon.svg'
  logo.alt = 'AB Academy Idiomas'
  brand.appendChild(logo)

  const cover = document.createElement('div')
  cover.className = 'material-document-cover'

  const eyebrow = document.createElement('span')
  eyebrow.textContent = 'AB ACADEMY IDIOMAS'

  const language = document.createElement('strong')
  language.textContent = getLanguageLabel(editor)

  cover.append(eyebrow, language)
  header.append(brand, cover)

  return header
}

function createPage(editor: HTMLElement, isFirstPage: boolean) {
  const page = document.createElement('section')
  page.className = 'material-html-document ' + MATERIAL_PAGE_CLASS
  page.setAttribute(PAGE_ATTR, 'true')
  // O editor raiz permanece como único editing host para manter cursor e seleção estáveis entre páginas.
  page.setAttribute('dir', 'ltr')
  page.style.direction = 'ltr'
  page.style.unicodeBidi = 'normal'
  page.dataset.pageNumber = '1'

  if (isFirstPage) {
    page.appendChild(createPageHeader(editor))
  }

  return page
}

function hasVisibleContent(page: HTMLElement) {
  return Array.from(page.childNodes).some((node) => !isPageHeader(node))
}

function fitsPage(page: HTMLElement) {
  return page.scrollHeight <= page.clientHeight + 1
}

function createTrailingBlock(source: HTMLElement, fragment: DocumentFragment) {
  const next = source.cloneNode(false) as HTMLElement
  next.appendChild(fragment)

  if (!next.textContent?.trim() && !next.querySelector('br,img,a')) {
    next.innerHTML = '<br />'
  }

  return next
}

function createTrailingParagraph(source: HTMLParagraphElement, fragment: DocumentFragment) {
  return createTrailingBlock(source, fragment) as HTMLParagraphElement
}

function isSplittableTextBlock(node: Node): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(node.tagName)
  )
}

function normalizeLogicalNodes(nodes: Node[]) {
  return nodes.flatMap((node) => {
    if (node instanceof Text && node.textContent?.trim()) {
      const paragraph = document.createElement('p')
      paragraph.textContent = node.textContent
      return [paragraph]
    }

    return [node]
  })
}

function getPageContentBottom(page: HTMLElement) {
  const styles = window.getComputedStyle(page)
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  return page.getBoundingClientRect().top + page.clientHeight - paddingBottom - 1
}

function findCharacterBoundary(page: HTMLElement, block: HTMLElement) {
  const pageBottom = getPageContentBottom(page)
  const textNodes: Text[] = []
  const lengths: number[] = []
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  let totalLength = 0

  while (node) {
    const length = node.nodeValue?.length || 0
    if (length) {
      textNodes.push(node)
      lengths.push(length)
      totalLength += length
    }
    node = walker.nextNode() as Text | null
  }

  if (!totalLength) return null

  const pointAt = (globalOffset: number) => {
    let remaining = Math.max(0, globalOffset)
    for (let index = 0; index < textNodes.length; index += 1) {
      if (remaining <= lengths[index]) {
        return {
          node: textNodes[index],
          offset: Math.min(remaining, lengths[index]),
        }
      }
      remaining -= lengths[index]
    }

    const lastIndex = textNodes.length - 1
    return {
      node: textNodes[lastIndex],
      offset: lengths[lastIndex],
    }
  }

  let low = 0
  let high = totalLength - 1
  let firstOverflowOffset = -1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const point = pointAt(middle)
    const range = document.createRange()
    range.setStart(point.node, point.offset)
    range.setEnd(point.node, Math.min(point.offset + 1, point.node.nodeValue?.length || 0))
    const rect = range.getBoundingClientRect()
    range.detach()

    if (rect.height > 0 && rect.bottom > pageBottom) {
      firstOverflowOffset = middle
      high = middle - 1
    } else {
      low = middle + 1
    }
  }

  return firstOverflowOffset >= 0 ? pointAt(firstOverflowOffset) : null
}

function splitBlockToNextPage(page: HTMLElement, block: HTMLElement) {
  const boundary = findCharacterBoundary(page, block)
  if (!boundary) return null

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const firstText = walker.nextNode()
  if (boundary.node === firstText && boundary.offset === 0) return null

  const trailingRange = document.createRange()
  trailingRange.setStart(boundary.node, boundary.offset)
  trailingRange.setEndAfter(block)
  const fragment = trailingRange.extractContents()
  trailingRange.detach()

  return createTrailingBlock(block, fragment)
}

function splitParagraphToNextPage(page: HTMLElement, paragraph: HTMLParagraphElement) {
  return splitBlockToNextPage(page, paragraph) as HTMLParagraphElement | null
}

function rebuildPages(editor: HTMLElement, nodes: Node[]) {
  // A paginação é uma projeção visual do fluxo lógico. Os nós continuam sendo
  // os mesmos nós do documento e o editor raiz continua sendo o único editing host.
  // As páginas são apenas containers de layout; nunca recebem contenteditable.
  Array.from(editor.children).filter(isPage).forEach((page) => page.remove())

  const pages: HTMLElement[] = []
  let currentPage = createPage(editor, true)
  currentPage.dataset.pageNumber = '1'
  editor.appendChild(currentPage)
  pages.push(currentPage)

  const createNextPage = () => {
    const nextPage = createPage(editor, false)
    nextPage.dataset.pageNumber = String(pages.length + 1)
    editor.appendChild(nextPage)
    pages.push(nextPage)
    currentPage = nextPage
    return nextPage
  }

  const contentChildren = (page: HTMLElement) =>
    Array.from(page.childNodes).filter((child) => !isPageHeader(child))

  const splitParagraphAcrossPages = (page: HTMLElement, paragraph: HTMLElement) => {
    let pageCursor = page
    let paragraphCursor = paragraph

    for (let guard = 0; guard < 1000 && !fitsPage(pageCursor); guard += 1) {
      const before = paragraphCursor.textContent?.length || 0
      const trailing = splitBlockToNextPage(pageCursor, paragraphCursor)
      if (!trailing) break

      const after = paragraphCursor.textContent?.length || 0
      // Não houve progresso: normalmente é um bloco indivisível (ex.: uma imagem
      // ou uma palavra sem ponto de quebra). Deixamos esse bloco inteiro no fluxo.
      if (after >= before) break

      const nextPage = createNextPage()
      nextPage.appendChild(trailing)
      pageCursor = nextPage
      paragraphCursor = trailing
    }

    return pageCursor
  }

  const placeNode = (node: Node) => {
    currentPage.appendChild(node)

    if (fitsPage(currentPage)) return

    const children = contentChildren(currentPage)

    // Um bloco normal que não cabe junto aos anteriores começa na página seguinte.
    // Isso evita criar uma página parcialmente vazia e reproduz o fluxo do Word.
    if (children.length > 1) {
      currentPage.removeChild(node)
      const nextPage = createNextPage()
      nextPage.appendChild(node)

      if (isSplittableTextBlock(node) && !fitsPage(nextPage)) {
        currentPage = splitParagraphAcrossPages(nextPage, node)
      }
      return
    }

    // Se o próprio bloco é maior que uma página, só parágrafos podem ser
    // fragmentados. Tabelas, imagens e outros blocos permanecem íntegros.
    if (isSplittableTextBlock(node)) {
      currentPage = splitParagraphAcrossPages(currentPage, node)
    }
  }

  nodes.forEach(placeNode)

  // Nunca deixa uma folha vazia no final.
  if (pages.length > 1 && !hasVisibleContent(pages[pages.length - 1])) {
    pages[pages.length - 1].remove()
    pages.pop()
  }

  pages.forEach((page, index) => {
    page.dataset.pageNumber = String(index + 1)
  })

  return pages
}

export function paginateMaterialEditor(editor: HTMLElement) {
  const nodes = normalizeLogicalNodes(getLogicalNodes(editor))
  const pages = rebuildPages(editor, nodes)

  return {
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    pageGap: PAGE_GAP,
    pageCount: Math.max(1, pages.length),
  }
}

export function stripMaterialPaginationForPersistence(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  const pages = Array.from(clone.children).filter(isPage)

  if (pages.length) {
    const fragment = document.createDocumentFragment()

    pages.forEach((page) => {
      Array.from(page.childNodes)
        .filter((node) => !isPageHeader(node))
        .forEach((node) => fragment.appendChild(node))
      page.remove()
    })

    clone.appendChild(fragment)
  }

  clone.querySelectorAll<HTMLElement>('[data-material-page]').forEach((element) => {
    element.removeAttribute('data-material-page')
    element.removeAttribute('data-page-number')
    element.removeAttribute('contenteditable')
    element.removeAttribute('role')
  })

  clone.querySelectorAll<HTMLElement>('[data-material-page-header]').forEach((element) => element.remove())

  // Compatibilidade com a paginação anterior baseada em offsets/spacers.
  clone.querySelectorAll<HTMLElement>('[data-material-pagination-spacer]').forEach((element) => element.remove())
  clone.querySelectorAll<HTMLElement>('[data-material-pagination-offset]').forEach((element) => {
    const original = element.getAttribute('data-material-pagination-margin-top') || ''
    element.style.marginTop = original
    element.removeAttribute('data-material-pagination-offset')
    element.removeAttribute('data-material-pagination-margin-top')
  })
  clone.querySelectorAll<HTMLElement>('[data-material-pagination-margin-top]').forEach((element) => {
    element.removeAttribute('data-material-pagination-margin-top')
  })

  return clone
}
