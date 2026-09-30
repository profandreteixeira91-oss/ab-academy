import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import logo from '../assets/logo_abacademy.png'

type MobileSystemHeaderProps = {
  title: string
}

const links = [
  { label: 'Início', href: '/' },
  { label: 'Sobre', href: '/#sobre', homeHref: '#sobre' },
  { label: 'Cursos', href: '/aulas' },
  { label: 'Metodologia', href: '/#metodologia', homeHref: '#metodologia' },
  { label: 'Planos', href: '/planos' },
  { label: 'Aula diagnóstica', href: '/diagnostica' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'Trabalhe conosco', href: '/trabalhe-conosco' },
  { label: 'Contato', href: '/quero-aprender' },
  { label: 'Área do aluno', href: '/aluno' },
  { label: 'Portal do professor', href: '/professor' },
]

export default function MobileSystemHeader({ title }: MobileSystemHeaderProps) {
  const [open, setOpen] = useState(false)
  const isHome = window.location.pathname === '/'

  return (
    <header className="mobile-system-header">
      <div className="mobile-system-header-inner">
        <a href="/" className="mobile-system-header-brand" aria-label="AB Academy - Início">
          <img src={logo} alt="AB Academy" />
        </a>

        <div className="mobile-system-header-title" aria-live="polite">
          <span>{title}</span>
        </div>

        <button
          type="button"
          className="mobile-system-header-menu"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav className="mobile-system-header-navigation" aria-label="Navegação principal">
          {links.map((link) => (
            <a key={link.label} href={isHome && link.homeHref ? link.homeHref : link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
