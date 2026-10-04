const PAGINATION_OFFSET_ATTR = 'data-material-pagination-offset'
const PAGINATION_ORIGINAL_MARGIN_ATTR = 'data-material-pagination-margin-top'

const PAGINATION_SELECTOR = [
  ':scope > p',
  ':scope > h1',
  ':scope > h2',
  ':scope > h3',
  ':scope > h4',
  ':scope > h5',
  ':scope > h6',
  ':scope > blockquote',
  ':scope > ul',
  ':scope > ol',
  ':scope > img',
  ':scope > table',
  ':scope > pre',
  ':scope > hr',
].join(',')

function isPaginationCandidate(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(PAGINATION_SELECTOR.replace(/:scope > /g, ''))
}

function rememberOriginalMargin(element: HTMLElement) {
  if (element.hasAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR)) return
  element.setAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR, element.style.marginTop)
}

function resetPaginationOffsets(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>(`[${PAGINATION_OFFSET_ATTR}]`).forEach((element) => {
    const original = element.getAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR) || ''
    element.style.marginTop = original
    element.removeAttribute(PAGINATION_OFFSET_ATTR)
  })
}

function getNumericStyle(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function paginateMaterialEditor(editor: HTMLElement) {
  resetPaginationOffsets(editor)

  const computed = window.getComputedStyle(editor)
  const borderTop = getNumericStyle(computed.borderTopWidth)
  const borderBottom = getNumericStyle(computed.borderBottomWidth)
  const paddingTop = getNumericStyle(computed.paddingTop)
  const paddingBottom = getNumericStyle(computed.paddingBottom)
  const pageHeight = 1123
  const contentOrigin = editor.getBoundingClientRect().top + borderTop
  const pageContentHeight = Math.max(1, pageHeight - borderTop - borderBottom - paddingTop - paddingBottom)

  const blocks = Array.from(editor.children).filter(isPaginationCandidate)
  let guard = 0

  // A paginação é derivada do DOM visível. Nenhum marcador de página é persistido
  // no HTML do material; apenas o espaçamento necessário para impedir que um bloco
  // atravesse o limite A4 é aplicado temporariamente ao elemento.
  while (guard < 4) {
    guard += 1
    let changed = false

    for (const block of blocks) {
      rememberOriginalMargin(block)

      const rect = block.getBoundingClientRect()
      const top = rect.top - contentOrigin
      const bottom = rect.bottom - contentOrigin

      if (bottom <= 0 || rect.height <= 0) continue

      const pageIndex = Math.max(0, Math.floor(top / pageHeight))
      const pageBottom = pageIndex * pageHeight + paddingTop + pageContentHeight

      if (top < pageBottom && bottom > pageBottom && rect.height <= pageContentHeight) {
        const nextPageTop = (pageIndex + 1) * pageHeight + paddingTop
        const offset = Math.max(0, nextPageTop - top)

        if (offset > 0.5) {
          const originalMargin = getNumericStyle(
            block.getAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR) || '',
          )
          block.style.marginTop = `${originalMargin + offset}px`
          block.setAttribute(PAGINATION_OFFSET_ATTR, String(offset))
          changed = true
        }
      }
    }

    if (!changed) break
  }

  return {
    pageHeight,
    pageContentHeight,
    pageCount: Math.max(1, Math.ceil(editor.scrollHeight / pageHeight)),
  }
}

export function stripMaterialPaginationForPersistence(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement

  clone.querySelectorAll<HTMLElement>(`[${PAGINATION_OFFSET_ATTR}]`).forEach((element) => {
    const original = element.getAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR) || ''
    element.style.marginTop = original
    element.removeAttribute(PAGINATION_OFFSET_ATTR)
    element.removeAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR)
  })

  clone.querySelectorAll<HTMLElement>(`[${PAGINATION_ORIGINAL_MARGIN_ATTR}]`).forEach((element) => {
    element.removeAttribute(PAGINATION_ORIGINAL_MARGIN_ATTR)
  })

  return clone
}
