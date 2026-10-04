const PAGINATION_SPACER_ATTR = 'data-material-pagination-spacer'
const PAGINATION_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'img',
  'table',
  'pre',
  'hr',
].join(',')

const PAGE_HEIGHT = 1123
const PAGE_GAP = 28
const PAGE_STEP = PAGE_HEIGHT + PAGE_GAP

function isPaginationCandidate(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(PAGINATION_SELECTOR)
}

function getNumericStyle(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function removePaginationSpacers(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>(`[${PAGINATION_SPACER_ATTR}]`).forEach((spacer) => {
    spacer.remove()
  })
}

function createPaginationSpacer(height: number) {
  const spacer = document.createElement('div')
  spacer.setAttribute(PAGINATION_SPACER_ATTR, 'true')
  spacer.setAttribute('contenteditable', 'false')
  spacer.setAttribute('aria-hidden', 'true')
  spacer.style.height = `${Math.max(0, Math.ceil(height))}px`
  spacer.style.margin = '0'
  spacer.style.padding = '0'
  spacer.style.border = '0'
  spacer.style.display = 'block'
  spacer.style.pointerEvents = 'none'
  return spacer
}

function insertPageSpacer(editor: HTMLElement, block: HTMLElement, contentOrigin: number, pageContentHeight: number) {
  const rect = block.getBoundingClientRect()
  const top = rect.top - contentOrigin
  const pageIndex = Math.max(0, Math.floor(top / PAGE_STEP))
  const pageBottom = pageIndex * PAGE_STEP + pageContentHeight

  if (top < pageBottom && rect.bottom - contentOrigin > pageBottom && rect.height <= pageContentHeight) {
    const nextPageTop = (pageIndex + 1) * PAGE_STEP
    const spacerHeight = nextPageTop - top
    if (spacerHeight > 0.5) {
      editor.insertBefore(createPaginationSpacer(spacerHeight), block)
      return true
    }
  }

  return false
}

export function paginateMaterialEditor(editor: HTMLElement) {
  removePaginationSpacers(editor)

  const computed = window.getComputedStyle(editor)
  const borderTop = getNumericStyle(computed.borderTopWidth)
  const borderBottom = getNumericStyle(computed.borderBottomWidth)
  const paddingTop = getNumericStyle(computed.paddingTop)
  const paddingBottom = getNumericStyle(computed.paddingBottom)
  const contentOrigin = editor.getBoundingClientRect().top + borderTop + paddingTop
  const pageContentHeight = Math.max(
    1,
    PAGE_HEIGHT - borderTop - borderBottom - paddingTop - paddingBottom,
  )

  const blocks = Array.from(editor.children).filter(isPaginationCandidate)
  let pageCount = 1

  for (const block of blocks) {
    const didBreak = insertPageSpacer(editor, block, contentOrigin, pageContentHeight)
    if (didBreak) pageCount += 1

    const rect = block.getBoundingClientRect()
    const bottom = rect.bottom - contentOrigin
    pageCount = Math.max(pageCount, Math.floor(Math.max(0, bottom - 1) / PAGE_STEP) + 1)
  }

  // Uma nova folha aparece somente quando o conteúdo realmente precisa dela.
  // O editor continua sendo um único documento lógico e os espaçadores são
  // removidos antes de qualquer persistência.
  return {
    pageHeight: PAGE_HEIGHT,
    pageGap: PAGE_GAP,
    pageContentHeight,
    pageCount: Math.max(1, pageCount),
  }
}

export function stripMaterialPaginationForPersistence(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll<HTMLElement>(`[${PAGINATION_SPACER_ATTR}]`).forEach((spacer) => {
    spacer.remove()
  })

  // Compatibilidade com versões anteriores que usavam offsets em margin-top.
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
