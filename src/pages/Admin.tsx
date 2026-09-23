import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Bell,
  BookOpen,
  Sparkles,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import Dashboard from './admin/Dashboard'
import Agenda from './admin/Agenda'
import Alunos from './admin/Alunos'
import Atividades from './admin/Atividades'
import Planos from './admin/planos'
import Equipe from './admin/Equipe'
import Financeiro from './admin/Financeiro'
import CentralAtividades from './admin/CentralAtividades'
import Comunicacao from './admin/Comunicacao'
import Candidaturas from './admin/Candidaturas'

import '../styles/Admin.css'
import '../styles/central-admin.css'
import logo from '../assets/logo_abacademy.png'

type AdminModule = {
  id: string
  title: string
  description: string
  icon: LucideIcon
}

const modules: AdminModule[] = [
  {
    id: 'central',
    title: 'Central de Atividades',
    description:
      'Gerencie a biblioteca de prática por idioma e nível.',
    icon: Sparkles,
  },
  {
    id: 'agenda',
    title: 'Agenda',
    description:
      'Gerencie horários, aulas e disponibilidade.',
    icon: CalendarDays,
  },
  {
    id: 'alunos',
    title: 'Alunos',
    description:
      'Acesse perfis, histórico e informações dos alunos.',
    icon: Users,
  },
  {
    id: 'atividades',
    title: 'Atividades',
    description:
      'Crie e acompanhe atividades individuais.',
    icon: ClipboardList,
  },
  {
    id: 'avaliacoes',
    title: 'Avaliações',
    description:
      'Acompanhe níveis e evolução dos alunos.',
    icon: GraduationCap,
  },
  {
    id: 'frequencia',
    title: 'Frequência',
    description:
      'Controle presença e histórico de aulas.',
    icon: CheckCircle2,
  },
  {
    id: 'matriculas',
    title: 'Matrículas',
    description:
      'Gerencie matrículas, planos e horários.',
    icon: Activity,
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description:
      'Controle pagamentos, receitas e pendências.',
    icon: DollarSign,
  },
  {
    id: 'planos',
    title: 'Planos',
    description:
      'Gerencie planos, preços e condições.',
    icon: ClipboardList,
  },
  {
    id: 'biblioteca',
    title: 'Biblioteca',
    description:
      'Organize materiais e conteúdos para alunos.',
    icon: BookOpen,
  },
  {
    id: 'comunicacao',
    title: 'Comunicação',
    description:
      'Envie avisos e mensagens aos alunos.',
    icon: MessageSquare,
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description:
      'Consulte indicadores e relatórios da escola.',
    icon: BarChart3,
  },
  {
    id: 'candidaturas',
    title: 'Candidaturas',
    description:
      'Receba e acompanhe candidaturas de professores.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'equipe',
    title: 'Equipe',
    description:
      'Gerencie professores e usuários administrativos.',
    icon: Users,
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    description:
      'Configure preferências e parâmetros do sistema.',
    icon: Settings,
  },
]

const navigation = [
  {
    section: 'Principal',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'agenda',
        label: 'Agenda',
        icon: CalendarDays,
      },
      {
        id: 'alunos',
        label: 'Alunos',
        icon: Users,
      },
    ],
  },
  {
    section: 'Acadêmico',
    items: [
      {
        id: 'atividades',
        label: 'Atividades',
        icon: ClipboardList,
      },
      {
        id: 'central',
        label: 'Central de Atividades',
        icon: Sparkles,
      },
      {
        id: 'avaliacoes',
        label: 'Avaliações',
        icon: GraduationCap,
      },
      {
        id: 'frequencia',
        label: 'Frequência',
        icon: CheckCircle2,
      },
      {
        id: 'matriculas',
        label: 'Matrículas',
        icon: Activity,
      },
    ],
  },
  {
    section: 'Gestão',
    items: [
      {
        id: 'financeiro',
        label: 'Financeiro',
        icon: DollarSign,
      },
      {
        id: 'planos',
        label: 'Planos',
        icon: ClipboardList,
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        icon: BarChart3,
      },
    ],
  },
  {
    section: 'Sistema',
    items: [
      {
        id: 'equipe',
        label: 'Equipe',
        icon: Users,
      },
      {
        id: 'biblioteca',
        label: 'Biblioteca',
        icon: BookOpen,
      },
      {
        id: 'comunicacao',
        label: 'Comunicação',
        icon: MessageSquare,
      },
      {
        id: 'candidaturas',
        label: 'Candidaturas',
        icon: BriefcaseBusiness,
      },
      {
        id: 'configuracoes',
        label: 'Configurações',
        icon: Settings,
      },
    ],
  },
]

export default function Admin() {
  const [sidebarOpen, setSidebarOpen] =
    useState(false)

  const [activeModule, setActiveModule] =
    useState('dashboard')

  useEffect(() => {
    const title =
      activeModule === 'dashboard'
        ? 'Dashboard'
        : modules.find((module) => module.id === activeModule)?.title ||
          'Administração'

    document.title = title + ' - AB Academy Idiomas'
  }, [activeModule])

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = ''
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow =
      window.innerWidth <= 900 ? 'hidden' : ''

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  const handleNavigation = (id: string) => {
    setActiveModule(id)
    setSidebarOpen(false)
  }

  const activeModuleData =
    modules.find(
      (module) => module.id === activeModule,
    )

  const activeTitle =
    activeModule === 'dashboard'
      ? 'Dashboard'
      : activeModuleData?.title ||
        'Administração'

  return (
    <div className="admin-page">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`admin-sidebar ${
          sidebarOpen ? 'open' : ''
        }`}
      >
        <div className="admin-sidebar-header">
          <img
            src={logo}
            alt="AB Academy"
            className="admin-sidebar-logo"
          />
        </div>

        <nav className="admin-sidebar-nav">
          {navigation.map((section) => (
            <div
              key={section.section}
              className="admin-sidebar-section"
            >
              <div className="admin-sidebar-section-title">
                {section.section}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon

                const isActive =
                  activeModule === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-nav-item ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={() =>
                      handleNavigation(item.id)
                    }
                  >
                    <span className="admin-nav-item-icon">
                      <Icon
                        size={19}
                        strokeWidth={1.9}
                      />
                    </span>

                    <span className="admin-nav-item-label">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-legal">
          <div className="admin-sidebar-legal-copy">
            <span>AB Academy® 2026 - Todos os direitos reservados</span>
            <span>
              Desenvolvido por{' '}
              <a href="https://www.amtsistemas.com.br/">
                AMT Sistemas &amp; Soluções
              </a>{' '}-{' '}
              <a href="https://www.amtsistemas.com.br/">
                www.amtsistemas.com.br
              </a>
            </span>
          </div>

          <div className="admin-sidebar-legal-links">
            <a href="/termos-de-servico">Termos de Serviço</a>
            <a href="/politica-privacidade">Política de Privacidade</a>
          </div>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-user-avatar">
              AD
            </div>

            <div className="admin-sidebar-user-info">
              <p className="admin-sidebar-user-name">
                Administrador
              </p>

              <p className="admin-sidebar-user-role">
                Administração
              </p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="admin-mobile-overlay"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="admin-main">

        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="admin-header">
          <div className="admin-header-left">
            <button
              type="button"
              className="admin-menu-button"
              onClick={() =>
                setSidebarOpen(
                  (current) => !current,
                )
              }
              aria-label={
                sidebarOpen
                  ? 'Fechar menu'
                  : 'Abrir menu'
              }
            >
              {sidebarOpen ? (
                <X size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>

            <div className="admin-header-title-wrapper">
              <h1 className="admin-header-title">
                {activeTitle}
              </h1>

              <p className="admin-header-subtitle">
                Gestão da AB Academy
              </p>
            </div>
          </div>

          <div className="admin-header-right">
            <button
              type="button"
              className="admin-header-action"
              aria-label="Notificações"
            >
              <Bell
                size={19}
                strokeWidth={1.9}
              />
            </button>
          </div>
        </header>

        {/* ===================================================
            CONTENT
        =================================================== */}

        <section className="admin-content">

          {/* =================================================
              DASHBOARD
          ================================================= */}

          {activeModule === 'dashboard' && (
            <Dashboard />
          )}

          {/* =================================================
              AGENDA
          ================================================= */}

          {activeModule === 'agenda' && (
            <Agenda />
          )}

          {/* =================================================
              ALUNOS
          ================================================= */}

          {activeModule === 'alunos' && (
            <Alunos />
          )}

            {/* =================================================
              ATIVIDADES
          ================================================= */}

          {activeModule === 'atividades' && (
            <Atividades />
          )}

               {/* =================================================
              CENTRAL DE ATIVIDADES
          ================================================= */}

          {activeModule === 'central' && (
            <CentralAtividades />
          )}

          {/* =================================================
              PLANOS
          ================================================= */}

          {activeModule === 'planos' && (
            <Planos />
          )}

          {/* =================================================
              FINANCEIRO
          ================================================= */}

          {activeModule === 'financeiro' && (
            <Financeiro />
          )}

          {/* =================================================
              EQUIPE
          ================================================= */}

          {activeModule === 'equipe' && (
            <Equipe />
          )}

          {activeModule === 'comunicacao' && (
            <Comunicacao />
          )}

          {activeModule === 'candidaturas' && (
            <Candidaturas />
          )}

          {/* =================================================
              DEMAIS MÓDULOS
          ================================================= */}

          {activeModule !== 'dashboard' &&
            activeModule !== 'agenda' &&
            activeModule !== 'alunos' &&
            activeModule !== 'atividades' &&
            activeModule !== 'central' &&
            activeModule !== 'planos' &&
            activeModule !== 'financeiro' &&
            activeModule !== 'equipe' &&
            activeModule !== 'comunicacao' &&
            activeModule !== 'candidaturas' && (
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <h2 className="admin-panel-title">
                    {activeTitle}
                  </h2>
                </div>

                <div className="admin-empty-state">
                  <div className="admin-empty-state-icon">
                    {activeModuleData?.icon ? (
                      (() => {
                        const Icon =
                          activeModuleData.icon

                        return (
                          <Icon
                            size={23}
                            strokeWidth={1.9}
                          />
                        )
                      })()
                    ) : (
                      <Settings
                        size={23}
                        strokeWidth={1.9}
                      />
                    )}
                  </div>

                  <h3 className="admin-empty-state-title">
                    Módulo em desenvolvimento
                  </h3>

                  <p className="admin-empty-state-description">
                    Esta área será implementada
                    na próxima etapa do painel
                    administrativo.
                  </p>
                </div>
              </div>
            )}

        </section>

      </main>

    </div>
  )
}
