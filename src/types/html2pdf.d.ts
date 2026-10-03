declare module 'html2pdf.js' {
  type Html2PdfWorker = {
    set: (options: Record<string, unknown>) => Html2PdfWorker
    from: (source: HTMLElement) => Html2PdfWorker
    toPdf: () => Html2PdfWorker
    outputPdf: (type?: 'blob') => Promise<Blob>
  }

  type Html2PdfFactory = () => Html2PdfWorker

  const html2pdf: Html2PdfFactory
  export default html2pdf
}
