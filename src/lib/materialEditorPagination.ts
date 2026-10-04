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
  page.setAttribute('contenteditable', 'true')
  page.setAttribute('role', 'textbox')
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

function createTrailingParagraph(source: HTMLParagraphElement, fragment: DocumentFragment) {
  const next = source.cloneNode(false) as HTMLParagraphElement
  next.appendChild(fragment)

  if (!next.textContent?.trim() && !next.querySelector('br,img,a')) {
    next.innerHTML = '<br />'
  }

  return next
}

function findCharacterBoundary(page: HTMLElement, paragraph: HTMLParagraphElement) {
  const pageBottom = page.getBoundingClientRect().bottom - 1
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let node: Text | null = walker.nextNode() as Text | null

  while (node) {
    const value = node.nodeValue || ''
    for (let offset = 0; offset < value.length; offset += 1) {
      const range = document.createRange()
      range.setStart(node, offset)
      range.setEnd(node, Math.min(offset + 1, value.length))
      const rect = range.getBoundingClientRect()
      range.detach()

      if (rect.height > 0 && rect.bottom > pageBottom) {
        return { node, offset }
      }
    }
    node = walker.nextNode() as Text | null
  }

  return null
}

function splitParagraphToNextPage(page: HTMLElement, paragraph: HTMLParagraphElement) {
  const boundary = findCharacterBoundary(page, paragraph)
  if (!boundary || (boundary.node === paragraph.firstChild && boundary.offset === 0)) {
    return null
  }

  const trailingRange = document.createRange()
  trailingRange.setStart(boundary.node, boundary.offset)
  trailingRange.setEndAfter(paragraph)
  const fragment = trailingRange.extractContents()
  trailingRange.detach()

  return createTrailingParagraph(paragraph, fragment)
}

function moveOverflowingParagraph(page: HTMLElement, paragraph: HTMLParagraphElement) {
  const nextParagraph = splitParagraphToNextPage(page, paragraph)
  if (!nextParagraph) return null

  paragraph.insertAdjacentElement('afterend', nextParagraph)
  return nextParagraph
}

function restoreSelection(range: Range | null) {
  if (!range) return
  const selection = window.getSelection()
  if (!selection) return

  try {
    if (!range.commonAncestorContainer.isConnected) return
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    // A seleção pode deixar de ser válida quando um bloco é dividido.
  }
}

function focusEditorPage(page: HTMLElement, range: Range | null) {
  if (!range) return
  page.focus({ preventScroll: true })
  restoreSelection(range)
}

function rebuildPages(editor: HTMLElement, nodes: Node[]) {
  const selection = window.getSelection()
  const activeRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null

  Array.from(editor.children).filter(isPage).forEach((page) => page.remove())

  const fragment = document.createDocumentFragment()
  nodes.forEach((node) => fragment.appendChild(node))

  const pages: HTMLElement[] = []
  let page = createPage(editor, true)
  page.dataset.pageNumber = '1'
  editor.appendChild(page)
  pages.push(page)

  Array.from(fragment.childNodes).forEach((node) => {
    page.appendChild(node)

    if (fitsPage(page)) return

    const onlyNode = !hasVisibleContent(page) || (
      Array.from(page.childNodes).filter((child) => !isPageHeader(child)).length === 1
    )

    if (onlyNode && node instanceof HTMLParagraphElement) {
      const nextParagraph = moveOverflowingParagraph(page, node)
      if (nextParagraph) {
        page.removeChild(nextParagraph)
      }
    }

    if (fitsPage(page)) return

    page.removeChild(node)

    const nextPage = createPage(editor, false)
    nextPage.dataset.pageNumber = String(pages.length + 1)
    editor.appendChild(nextPage)
    pages.push(nextPage)
    page = nextPage
    page.appendChild(node)

    if (!fitsPage(page) && node instanceof HTMLParagraphElement) {
      let currentParagraph = node
      let guard = 0

      while (!fitsPage(page) && guard < 20) {
        guard += 1
        const trailingParagraph = moveOverflowingParagraph(page, currentParagraph)
        if (!trailingParagraph) break

        const followingPage = createPage(editor, false)
        followingPage.dataset.pageNumber = String(pages.length + 1)
        editor.appendChild(followingPage)
        pages.push(followingPage)
        followingPage.appendChild(trailingParagraph)
        page = followingPage
        currentParagraph = trailingParagraph
      }
    }
  })

  if (!hasVisibleContent(page) && pages.length > 1) {
    pages.pop()
    page.remove()
  }

  pages.forEach((currentPage, index) => {
    currentPage.dataset.pageNumber = String(index + 1)
  })

  requestAnimationFrame(() => {
    focusEditorPage(pages[Math.max(0, pages.length - 1)] || editor, activeRange)
  })

  return pages
}

export function paginateMaterialEditor(editor: HTMLElement) {
  const nodes = getLogicalNodes(editor)
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
