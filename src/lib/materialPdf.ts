import html2pdf from 'html2pdf.js'
import logo from '../assets/logo_abacademy.png'

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
        // O html2canvas ainda tentará carregar a URL original com useCORS.
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

  const header = document.createElement('header')
  header.style.display = 'flex'
  header.style.alignItems = 'center'
  header.style.gap = '16px'
  header.style.paddingBottom = '24px'
  header.style.marginBottom = '28px'
  header.style.borderBottom = '1px solid #e2e8f0'

  const brand = document.createElement('img')
  brand.src = logo
  brand.alt = 'AB Academy Idiomas'
  brand.style.width = '76px'
  brand.style.height = 'auto'
  brand.style.objectFit = 'contain'

  const heading = document.createElement('div')
  const eyebrow = document.createElement('div')
  eyebrow.textContent = language || 'Material de apoio'
  eyebrow.style.fontSize = '11px'
  eyebrow.style.fontWeight = '700'
  eyebrow.style.letterSpacing = '0.08em'
  eyebrow.style.textTransform = 'uppercase'
  eyebrow.style.color = '#2563eb'
  eyebrow.style.marginBottom = '4px'

  const titleElement = document.createElement('h1')
  titleElement.textContent = title
  titleElement.style.margin = '0'
  titleElement.style.fontSize = '25px'
  titleElement.style.lineHeight = '1.2'
  titleElement.style.color = '#172033'

  heading.append(eyebrow, titleElement)
  header.append(brand, heading)
  page.appendChild(header)

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

  const footer = document.createElement('footer')
  footer.textContent = 'AB Academy Idiomas® 2026 · Material educacional de uso exclusivo do aluno'
  footer.style.marginTop = '32px'
  footer.style.paddingTop = '16px'
  footer.style.borderTop = '1px solid #e2e8f0'
  footer.style.fontSize = '10px'
  footer.style.color = '#64748b'
  page.appendChild(footer)

  // O elemento precisa permanecer renderizável para o html2canvas. Ele fica
  // abaixo da viewport, em vez de display:none ou fora do documento.
  page.style.position = 'absolute'
  page.style.left = '0'
  page.style.top = `${window.scrollY + window.innerHeight}px`
  page.style.pointerEvents = 'none'
  document.body.appendChild(page)

  try {
    await inlineImages(page)
    await waitForImages(page)

    const worker = html2pdf()
      .set({
        margin: [24, 24, 28, 24],
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
          mode: ['css', 'legacy'],
          avoid: ['img', 'table', 'tr'],
        },
      })
      .from(page)
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
