
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AccessToken } from 'npm:livekit-server-sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    /* =====================================================
       AUTENTICAÇÃO
       ===================================================== */

    const authorization =
      req.headers.get('Authorization')

    if (!authorization) {
      return new Response(
        JSON.stringify({
          error: 'Usuário não autenticado.',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    )

    const {
      data: {
        user,
      },
      error: userError,
    } = await supabaseAuth.auth.getUser()

    if (userError || !user) {
      console.error(
        'Erro de autenticação:',
        userError,
      )

      return new Response(
        JSON.stringify({
          error: 'Sessão inválida.',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    /* =====================================================
       CLIENTE ADMINISTRATIVO
       ===================================================== */

    const serviceRoleKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      )

    if (!serviceRoleKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY não configurada.',
      )
    }

    const supabaseAdmin =
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey,
      )

    /* =====================================================
       DADOS DA REQUISIÇÃO
       ===================================================== */

    let body: {
      lessonId?: string
    }

    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({
          error:
            'Corpo da requisição inválido.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        },
      )
    }

    const lessonId =
      typeof body.lessonId === 'string'
        ? body.lessonId.trim()
        : ''

    if (!lessonId) {
      return new Response(
        JSON.stringify({
          error:
            'ID da aula não informado.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        },
      )
    }

    /* =====================================================
       VERIFICAR ALUNO
       ===================================================== */

    const {
      data: student,
      error: studentError,
    } =
      await supabaseAdmin
        .from('alunos')
        .select(`
          id,
          nome_completo,
          user_id
        `)
        .eq(
          'user_id',
          user.id,
        )
        .maybeSingle()

    if (studentError) {
      console.error(
        'Erro ao consultar aluno:',
        studentError,
      )

      throw new Error(
        `Erro ao consultar aluno: ${studentError.message}`,
      )
    }

    /* =====================================================
       VERIFICAR ADMINISTRADOR
       ===================================================== */

    const {
      data: adminUser,
      error: adminError,
    } =
      await supabaseAdmin
        .from('admin_users')
        .select(`
          id,
          user_id,
          ativo
        `)
        .eq(
          'user_id',
          user.id,
        )
        .eq(
          'ativo',
          true,
        )
        .maybeSingle()

    if (adminError) {
      console.error(
        'Erro ao consultar administrador:',
        adminError,
      )

      throw new Error(
        `Erro ao verificar administrador: ${adminError.message}`,
      )
    }

    /* =====================================================
       VERIFICAR PROFESSOR
       ===================================================== */

    const {
      data: professor,
      error: professorError,
    } =
      await supabaseAdmin
        .from('professores')
        .select(`
          id,
          user_id,
          nome_completo,
          ativo,
          acesso_portal
        `)
        .eq(
          'user_id',
          user.id,
        )
        .maybeSingle()

    if (professorError) {
      console.error(
        'Erro ao consultar professor:',
        professorError,
      )

      throw new Error(
        `Erro ao verificar professor: ${professorError.message}`,
      )
    }

    const isStudent =
      !!student

    const isAdmin =
      !!adminUser

    const isTeacher =
      !!professor &&
      professor.ativo === true &&
      professor.acesso_portal === true

    console.log(
      JSON.stringify({
        userId: user.id,
        email: user.email,
        isStudent,
        isAdmin,
        isTeacher,
        lessonId,
      }),
    )

    /* =====================================================
       VERIFICAR PERMISSÃO GERAL
       ===================================================== */

    if (
      !isStudent &&
      !isTeacher &&
      !isAdmin
    ) {
      return new Response(
        JSON.stringify({
          error:
            'Usuário não possui permissão para entrar em aulas.',
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        },
      )
    }

    /* =====================================================
       BUSCAR AULA
       ===================================================== */

    const {
      data: lesson,
      error: lessonError,
    } =
      await supabaseAdmin
        .from('horarios')
        .select(`
          id,
          aluno_id,
          professor_id,
          idioma,
          dia_semana,
          hora_inicio,
          hora_fim,
          disponivel
        `)
        .eq(
          'id',
          lessonId,
        )
        .maybeSingle()

    if (lessonError) {
      console.error(
        'Erro ao consultar aula:',
        lessonError,
      )

      throw new Error(
        `Erro ao consultar aula: ${lessonError.message}`,
      )
    }

    if (!lesson) {
      return new Response(
        JSON.stringify({
          error:
            'Aula não encontrada.',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        },
      )
    }

    /* =====================================================
       AUTORIZAÇÃO DO ACESSO À AULA
       ===================================================== */

    let accessRole: 'teacher' | 'student' | null = null
    if (isAdmin) accessRole = 'teacher'
    else if (isTeacher && lesson.professor_id === professor?.id) accessRole = 'teacher'
    else if (isStudent && lesson.aluno_id === student.id) accessRole = 'student'

    if (!accessRole) {
      console.warn('Usuário tentou acessar aula sem vínculo:', { userId: user.id, lessonId: lesson.id })
      return new Response(
        JSON.stringify({ error: 'Você não possui acesso a esta aula.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    /* =====================================================
       CONFIGURAÇÃO LIVEKIT
       ===================================================== */

    const livekitUrl =
      Deno.env.get(
        'LIVEKIT_URL',
      )

    const apiKey =
      Deno.env.get(
        'LIVEKIT_API_KEY',
      )

    const apiSecret =
      Deno.env.get(
        'LIVEKIT_API_SECRET',
      )

    if (
      !livekitUrl ||
      !apiKey ||
      !apiSecret
    ) {
      throw new Error(
        'Configuração do LiveKit não encontrada.',
      )
    }

    /* =====================================================
       NOME DA SALA
       ===================================================== */

    /* O LiveKit cria a sala automaticamente no primeiro participante. */
    const roomName = `ab-aula-${lesson.id}`

    /* =====================================================
       IDENTIDADE
       ===================================================== */

    let identity: string
    let name: string
    let role: 'teacher' | 'student'

    if (accessRole === 'teacher') {
      identity = isAdmin ? `admin-${user.id}` : `professor-${user.id}`
      name = isAdmin ? 'Administrador' : professor?.nome_completo || 'Professor'
      role = 'teacher'
    } else {
      identity = `aluno-${user.id}`
      name = student?.nome_completo || 'Aluno'
      role = 'student'
    }

    /* =====================================================
       METADATA
       ===================================================== */

    const metadata =
      JSON.stringify({
        role,
        userId: user.id,
        lessonId: lesson.id,
        professorId:
          professor?.id ||
          null,
        studentId:
          student?.id ||
          null,
      })

    /* =====================================================
       GERAR TOKEN LIVEKIT
       ===================================================== */

    const token =
      new AccessToken(
        apiKey,
        apiSecret,
        {
          identity,
          name,
          metadata,
        },
      )

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const jwt =
      await token.toJwt()

    /* =====================================================
       RESPOSTA
       ===================================================== */

    return new Response(
      JSON.stringify({
        token: jwt,
        url: livekitUrl,
        roomName,
        identity,
        name,
        role,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      },
    )
  } catch (error) {
    console.error(
      'Erro ao gerar token LiveKit:',
      error,
    )

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao gerar acesso à sala.',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      },
    )
  }
})
