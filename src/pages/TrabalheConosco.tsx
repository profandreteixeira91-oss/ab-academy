import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, FileText, Upload, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/trabalhe-conosco.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024

function TrabalheConosco() {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', cidade: '', idiomas: '', nivel: '', experiencia: '', linkedin: '', portfolio: '', motivacao: '' })
  const [curriculo, setCurriculo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (file && file.size > MAX_FILE_SIZE) {
      setError('O currículo deve ter no máximo 10 MB.')
      setCurriculo(null)
      event.target.value = ''
      return
    }
    if (file && !['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      setError('Envie o currículo em PDF ou Word.')
      setCurriculo(null)
      event.target.value = ''
      return
    }
    setError('')
    setCurriculo(file)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    let applicationId: string | null = null
    let resumePath: string | null = null

    try {
      if (!curriculo) throw new Error('Anexe seu currículo para continuar.')
      if (!form.linkedin.trim()) throw new Error('Informe o link do seu perfil no LinkedIn.')

      const { data, error: insertError } = await supabase
        .from('candidaturas_professores')
        .insert({
          nome: form.nome.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim() || null,
          cidade: form.cidade.trim() || null,
          idiomas: form.idiomas.trim(),
          nivel: form.nivel,
          experiencia: form.experiencia.trim() || null,
          linkedin_url: form.linkedin.trim(),
          portfolio_url: form.portfolio.trim() || null,
          motivacao: form.motivacao.trim() || null,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      applicationId = data.id

      const extension = curriculo.name.split('.').pop()?.toLowerCase() || 'pdf'
      resumePath = `${applicationId}/curriculo.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('curriculos-professores')
        .upload(resumePath, curriculo, { contentType: curriculo.type, upsert: true })

      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('candidaturas_professores')
        .update({ curriculo_path: resumePath })
        .eq('id', applicationId)

      if (updateError) throw updateError
      setSuccess(true)
    } catch (submitError) {
      console.error('Erro ao enviar candidatura:', submitError)
      if (resumePath) await supabase.storage.from('curriculos-professores').remove([resumePath])
      if (applicationId) await supabase.from('candidaturas_professores').delete().eq('id', applicationId)
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível enviar sua candidatura. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="careers-page">
        <header className="careers-header"><a href="/" className="careers-back"><ArrowLeft size={18} />Voltar para a AB Academy</a></header>
        <main className="careers-success"><div className="careers-success-card">
          <CheckCircle2 size={52} />
          <span className="careers-label">Candidatura recebida</span>
          <h1>Obrigado pelo seu interesse em fazer parte da AB Academy.</h1>
          <p>Seus dados, currículo e perfil do LinkedIn foram enviados com sucesso. Caso seu perfil esteja alinhado às nossas oportunidades, entraremos em contato.</p>
          <a href="/" className="btn btn-primary">Voltar para a página inicial</a>
        </div></main>
      </div>
    )
  }

  return (
    <div className="careers-page">
      <header className="careers-header"><a href="/" className="careers-back"><ArrowLeft size={18} />Voltar para a AB Academy</a></header>
      <main className="careers-main">
        <div className="container careers-layout">
          <section className="careers-intro">
            <span className="careers-label">Trabalhe conosco</span>
            <h1>Faça parte da equipe AB Academy.</h1>
            <p>Buscamos professores que compartilhem nosso compromisso com uma experiência de aprendizagem prática, humana e transformadora.</p>
            <div className="careers-points">
              <div><UserRound size={20} /><span>Dados profissionais e experiência</span></div>
              <div><span className="careers-linkedin-icon" aria-hidden="true">in</span><span>Perfil profissional no LinkedIn</span></div>
              <div><FileText size={20} /><span>Currículo para nosso banco de talentos</span></div>
            </div>
          </section>

          <section className="careers-form-card">
            <form onSubmit={handleSubmit}>
              <div className="careers-form-heading"><h2>Cadastro de professor</h2><p>Preencha seus dados para enviar sua candidatura.</p></div>
              <div className="careers-form-grid">
                <label>Nome completo *<input name="nome" value={form.nome} onChange={handleChange} required /></label>
                <label>E-mail *<input type="email" name="email" value={form.email} onChange={handleChange} required /></label>
                <label>Telefone / WhatsApp<input name="telefone" value={form.telefone} onChange={handleChange} /></label>
                <label>Cidade / Estado<input name="cidade" value={form.cidade} onChange={handleChange} /></label>
                <label>Idioma(s) que leciona *<input name="idiomas" value={form.idiomas} onChange={handleChange} placeholder="Ex.: Inglês, Alemão" required /></label>
                <label>Nível de proficiência *<select name="nivel" value={form.nivel} onChange={handleChange} required><option value="">Selecione</option><option value="fluente">Fluente</option><option value="avancado">Avançado</option><option value="nativo">Nativo</option></select></label>
              </div>
              <label>Experiência como professor<textarea name="experiencia" value={form.experiencia} onChange={handleChange} rows={4} placeholder="Conte brevemente sobre sua experiência, formação e atuação." /></label>
              <label className="careers-linkedin-field"><span>Perfil do LinkedIn *</span><div className="careers-input-icon"><span className="careers-linkedin-icon" aria-hidden="true">in</span><input type="url" name="linkedin" value={form.linkedin} onChange={handleChange} placeholder="https://www.linkedin.com/in/seu-perfil" required /></div></label>
              <label>Portfólio ou outro perfil profissional<input type="url" name="portfolio" value={form.portfolio} onChange={handleChange} placeholder="https://..." /></label>
              <label>Por que gostaria de trabalhar na AB Academy?<textarea name="motivacao" value={form.motivacao} onChange={handleChange} rows={4} /></label>
              <label className="careers-upload">
                <span>Currículo *</span>
                <div className="careers-upload-box"><Upload size={22} /><strong>{curriculo ? curriculo.name : 'Selecione seu currículo'}</strong><small>PDF ou Word • máximo de 10 MB</small><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} required={!curriculo} /></div>
              </label>
              {error && <div className="careers-error">{error}</div>}
              <button type="submit" className="btn btn-primary careers-submit" disabled={loading}>{loading ? 'Enviando candidatura...' : 'Enviar candidatura'}{!loading && <ArrowLeft className="careers-submit-arrow" size={18} />}</button>
              <p className="careers-privacy">Ao enviar, você concorda com o uso dessas informações pela AB Academy para fins de recrutamento e seleção.</p>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}

export default TrabalheConosco
