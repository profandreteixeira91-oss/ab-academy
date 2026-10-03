import { useMemo } from 'react'
import { ArrowLeft, Download, X } from 'lucide-react'
import logo from '../assets/logo_abacademy.png'

export type MaterialRecord = {
  id:string; titulo:string; idioma:'ingles'|'alemao'|null; conteudo_html:string; imagens:string[]; videos:string[]
  status:'rascunho'|'publicado'; created_at:string; updated_at:string; publicado_em:string|null; pdf_publicado_path?:string|null
}
type Props={material:MaterialRecord; imageUrls?:Record<string,string>; onClose?:()=>void}
function sanitizeHtml(value:string){
  if(typeof window==='undefined') return value
  const doc=new DOMParser().parseFromString(value,'text/html')
  doc.querySelectorAll('script,style,object,embed,iframe,form').forEach(n=>n.remove())
  doc.querySelectorAll('*').forEach(n=>Array.from(n.attributes).forEach(a=>{
    const name=a.name.toLowerCase(), val=a.value.trim().toLowerCase()
    if(name.startsWith('on')) n.removeAttribute(a.name)
    if((name==='href'||name==='src')&&(val.startsWith('javascript:')||val.startsWith('data:text/html'))) n.removeAttribute(a.name)
  }))
  return doc.body.innerHTML
}
export default function MaterialViewer({material,imageUrls={},onClose}:Props){
  const content=useMemo(()=>{let html=sanitizeHtml(material.conteudo_html||'<p>Este material ainda não possui conteúdo.</p>');Object.entries(imageUrls).forEach(([p,u])=>{html=html.split(p).join(u)});return html},[material.conteudo_html,imageUrls])
  const language=material.idioma==='ingles'?'Inglês':material.idioma==='alemao'?'Alemão':'Material de apoio'
  return <div className="material-viewer">
    <div className="material-viewer-toolbar no-print">
      {onClose&&<button type="button" className="material-viewer-back" onClick={onClose}><ArrowLeft size={18}/> Voltar</button>}
      <div className="material-viewer-actions"><button type="button" className="material-viewer-download" onClick={()=>window.print()}><Download size={17}/> Baixar PDF</button>{onClose&&<button type="button" className="material-viewer-close" onClick={onClose}><X size={18}/></button>}</div>
    </div>
    <article className="material-document">
      <header className="material-document-header"><img src={logo} alt="AB Academy Idiomas"/><div><span>AB ACADEMY IDIOMAS</span><strong>{material.titulo}</strong><small>{language}</small></div></header>
      <div className="material-document-body" dangerouslySetInnerHTML={{__html:content}}/>
      <footer className="material-document-footer">AB Academy Idiomas® 2026 · Material educacional de uso exclusivo do aluno</footer>
    </article>
  </div>
}