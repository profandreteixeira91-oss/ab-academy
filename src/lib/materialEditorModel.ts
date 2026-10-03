export type EditorModelNode = {
  type: 'element' | 'text'
  tag?: string
  attrs?: Record<string, string>
  text?: string
  children?: EditorModelNode[]
}

export type EditorSelectionState = {
  anchorPath: number[]
  anchorOffset: number
  focusPath: number[]
  focusOffset: number
  direction?: 'forward' | 'backward'
}

export type EditorOperation = {
  id: string
  type: string
  at: string
  version: number
}

function attrsOf(element: Element) {
  const attrs: Record<string, string> = {}
  Array.from(element.attributes).forEach((attribute) => {
    attrs[attribute.name] = attribute.value
  })
  return attrs
}

export function domToEditorModel(root: HTMLElement): EditorModelNode {
  return {
    type: 'element',
    tag: 'div',
    attrs: {},
    children: Array.from(root.childNodes).map(nodeToModel),
  }
}

function nodeToModel(node: Node): EditorModelNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: 'text', text: node.nodeValue || '' }
  }

  if (node instanceof Element) {
    return {
      type: 'element',
      tag: node.tagName.toLowerCase(),
      attrs: attrsOf(node),
      children: Array.from(node.childNodes).map(nodeToModel),
    }
  }

  return { type: 'text', text: '' }
}

function modelToNode(model: EditorModelNode): Node {
  if (model.type === 'text') return document.createTextNode(model.text || '')

  const element = document.createElement(model.tag || 'div')
  Object.entries(model.attrs || {}).forEach(([name, value]) => {
    element.setAttribute(name, value)
  })
  ;(model.children || []).forEach((child) => element.appendChild(modelToNode(child)))
  return element
}

export function editorModelToHtml(model: EditorModelNode): string {
  const fragment = document.createDocumentFragment()
  ;(model.children || []).forEach((child) => fragment.appendChild(modelToNode(child)))
  const wrapper = document.createElement('div')
  wrapper.appendChild(fragment)
  return wrapper.innerHTML
}

function pathForNode(root: Node, target: Node): number[] | null {
  if (root === target) return []
  let current: Node | null = target
  const path: number[] = []
  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) return null
    const index = Array.prototype.indexOf.call(parent.childNodes, current)
    path.unshift(index)
    current = parent
  }
  return current === root ? path : null
}

function nodeAtPath(root: Node, path: number[]) {
  let node = root
  for (const index of path) {
    node = node.childNodes[index]
    if (!node) return null
  }
  return node
}

export function captureEditorSelection(root: HTMLElement): EditorSelectionState | null {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return null

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null

  const anchorPath = pathForNode(root, selection.anchorNode || range.startContainer)
  const focusPath = pathForNode(root, selection.focusNode || range.endContainer)
  if (!anchorPath || !focusPath) return null

  return {
    anchorPath,
    anchorOffset: selection.anchorOffset,
    focusPath,
    focusOffset: selection.focusOffset,
    direction: selection.anchorNode === selection.focusNode
      ? selection.anchorOffset <= selection.focusOffset ? 'forward' : 'backward'
      : 'forward',
  }
}

export function restoreEditorSelection(root: HTMLElement, state: EditorSelectionState | null) {
  if (!state) return
  const anchorNode = nodeAtPath(root, state.anchorPath)
  const focusNode = nodeAtPath(root, state.focusPath)
  if (!anchorNode || !focusNode) return

  const selection = window.getSelection()
  if (!selection) return

  try {
    selection.removeAllRanges()
    const range = document.createRange()
    range.setStart(anchorNode, Math.min(state.anchorOffset, anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.textContent?.length || 0 : anchorNode.childNodes.length))
    range.setEnd(focusNode, Math.min(state.focusOffset, focusNode.nodeType === Node.TEXT_NODE ? focusNode.textContent?.length || 0 : focusNode.childNodes.length))
    selection.addRange(range)
    root.focus()
  } catch {
    // Seleções podem se tornar inválidas quando o DOM muda. O documento
    // continua íntegro mesmo que o cursor não possa ser restaurado.
  }
}

export function createEditorOperation(type: string, version: number): EditorOperation {
  return { id: crypto.randomUUID(), type, at: new Date().toISOString(), version }
}
