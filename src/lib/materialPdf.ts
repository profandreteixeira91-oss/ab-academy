import html2pdf from 'html2pdf.js'
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

export async function generateMaterialPdf(
  title: string,
  language: string,
  source: HTMLElement,
): Promise<Blob> {
  const page = document.createElement('article')
  page.style.width = '794px'
  page.style.boxSizing = 'border-box'
  page.style.padding = '48px 52px'
  page.style.background = '#ffffff'
  page.style.color = '#172033'
  page.style.fontFamily = 'Arial, Helvetica, sans-serif'
  page.style.fontSize = '14px'
  page.style.lineHeight = '1.55'

  const body = source.cloneNode(true) as HTMLElement
  body.removeAttribute('contenteditable')
  body.querySelectorAll('[contenteditable]').forEach((element) => {
    element.removeAttribute('contenteditable')
  })

  body.style.width = '100%'
  body.style.margin = '0'
  body.style.padding = '0'
  body.style.border = '0'
  body.style.boxShadow = 'none'
  body.style.background = 'transparent'

  body.querySelectorAll('img').forEach((image) => {
    image.style.maxWidth = '100%'
    image.style.height = 'auto'
    image.style.breakInside = 'avoid'
    image.style.pageBreakInside = 'avoid'
  })

  body.querySelectorAll('table').forEach((table) => {
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.breakInside = 'avoid'
    table.style.pageBreakInside = 'avoid'
  })

  body.querySelectorAll('th, td').forEach((cell) => {
    cell.style.border = '1px solid #cbd5e1'
    cell.style.padding = '8px'
    cell.style.verticalAlign = 'top'
  })

  page.appendChild(body)

  // O elemento precisa permanecer dentro da viewport para o html2canvas.
  // Não usamos display:none nem uma posição fora da área renderizada.
  page.style.position = 'fixed'
  page.style.left = '0'
  page.style.top = '0'
  // O html2canvas precisa enxergar o elemento na árvore visual. z-index negativo
  // pode fazer o conteúdo desaparecer do snapshot/canvas mesmo estando na viewport.
  page.style.zIndex = '2147483647'
  page.style.pointerEvents = 'none'
  document.body.appendChild(page)

  try {
    await inlineImages(page)
    await waitForImages(page)

    const worker = html2pdf()
      .set({
        margin: 0,
        filename: title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.pdf',
        image: { type: 'jpeg', quality: 0.96 },
        enableLinks: true,
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          windowWidth: 794,
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
          avoid: ['img', 'table', 'tr'],
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
