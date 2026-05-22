const SUPABASE_URL = "https://wyjrjioipqfltdyupfna.supabase.co";
const SUPABASE_KEY = "sb_publishable_PkDkt5S-_rdrT0HhANoPAw_ZWluV2_H";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

/* ═══════════════════════════════════════════════
   AGENDAPRO — app.js CORRIGIDO COMPLETO
═══════════════════════════════════════════════ */

// ── STATE ──
let state = {
  user: null, empresa: null, perfil: null,
  categorias: [], clientes: [], servicos: [],
  profissionais: [], agendamentos: [], pagamentos: [],
  pubEmpresa: null, pubServico: null, pubProfissional: null
};

let _agendaFilter = 'todos';
let _confirmCb = null;
let _editSaveCb = null;
let _recusaId = null;
let _recusaMotivo = null;
let _reagendarId = null;
let _openMenu = null;
let _openMenuBtn = null;
let autoSyncTimer = null;
let lastIds = new Set();
let realtimeChannel = null;

// ── UTILS ──
function $(id) { return document.getElementById(id); }

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v;
}

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function slugify(s) {
  return (s || '').toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').substring(0, 60);
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function mesPrefixo() { return new Date().toISOString().slice(0, 7); }
function publicUrl(slug) { 
return location.origin + location.pathname + 'agendar/' + slug + '/'; }
function initial(name) { return (name || '?').trim().substring(0, 1).toUpperCase(); }

function formatDate(d) {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

function buildWaLink(tel, msg) {
  const n = (tel || '').replace(/\D/g, '');
  if (!n) return null;
  const f = n.startsWith('55') ? n : '55' + n;
  return 'https://wa.me/' + f + '?text=' + encodeURIComponent(msg);
}

function normStatus(s) {
  const r = (s || 'pendente').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (r === 'confirmado' || r === 'confirmada') return 'Confirmado';
  if (r === 'pendente') return 'Pendente';
  if (r === 'concluido' || r === 'concluida') return 'Concluído';
  if (r === 'recusado' || r === 'recusada' || r === 'cancelado') return 'Recusado';
  if (r === 'reagendado' || r === 'reagendada') return 'Reagendado';
  if (r === 'excluido' || r === 'excluida') return 'Excluído';
  return s || 'Pendente';
}

function badgeClass(s) {
  const n = normStatus(s);
  const m = {
    Confirmado: 'badge-green', Pendente: 'badge-yellow',
    'Concluído': 'badge-blue', Recusado: 'badge-red',
    Reagendado: 'badge-purple', 'Excluído': 'badge-gray'
  };
  return m[n] || 'badge-gray';
}

function isFinanceiro(a) {
  if (normStatus(a.status) === 'Concluído') return true;
  if (normStatus(a.status) === 'Excluído' && a.financeiro_status === 'Concluído') return true;
  return false;
}

function isAtivoCliente(c) {
  const st = (c?.status || '').toLowerCase().trim();
  if (st === 'inativo' || st === 'excluido' || st === 'excluído') return false;
  if (c?.ativo === false) return false;
  return true;
}

function podeTerAcoes(a) {
  return !['Excluído', 'Recusado', 'Concluído'].includes(normStatus(a.status));
}

// ── TOAST / NOTIF ──
function toast(msg, type = 'info') {
  const typeMap = { ok: 'ok', err: 'err', warn: 'info', info: 'info' };
  showNotif(msg, '', typeMap[type] || 'info');
}

function showNotif(title, msg = '', type = 'info', duration = 5000) {
  const stack = $('notifStack');
  if (!stack) return;
  const item = document.createElement('div');
  item.className = 'notif-item';
  const now = new Date();
  const t = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const icons = { new: '📅', ok: '✅', err: '⚠️', info: '💬' };
  item.innerHTML = `
    <div class="notif-icon ${type}">${icons[type] || '🔔'}</div>
    <div class="notif-body">
      <div class="notif-title">${title}</div>
      ${msg ? `<div class="notif-msg">${msg}</div>` : ''}
      <div class="notif-time">${t}</div>
    </div>
    <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
  `;
  stack.prepend(item);
  while (stack.children.length > 4) stack.lastChild.remove();
  setTimeout(() => {
    item.classList.add('out');
    setTimeout(() => { if (item.parentElement) item.remove(); }, 450);
  }, duration);
  const dot = $('notifDot');
  if (dot) dot.classList.add('on');
}

function clearNotifDot() {
  const dot = $('notifDot');
  if (dot) dot.classList.remove('on');
}

// ── SCROLL NAV ──
window.addEventListener('scroll', () => {
  const nav = $('landNav');
  if (nav) nav.classList.toggle('scrolled', scrollY > 40);
});

// ── HASH ROUTING ──
window.addEventListener('hashchange', () => {
  const slug = getPublicSlug();
  if (slug) loadPublic(slug);
});

// ── FECHAR MENUS AO CLICAR FORA ──
// FIX: só fecha se o clique NÃO foi dentro do dropdown aberto
document.addEventListener('click', function(e) {
  if (_openMenu) {
    // Se clicou no próprio botão que abriu — o handler do btn já trata
    if (_openMenuBtn && _openMenuBtn.contains(e.target)) return;
    // Se clicou dentro do dropdown — não fecha
    if (_openMenu.contains(e.target)) return;
    closeAllMenus();
  }
});

// Fecha menus ao rolar (evita dropdown desalinhado)
// PATCH: não fecha dropdown ao rolar, para não sumir antes do clique.

// ── INIT ──
window.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadCategorias();

  const slug = getPublicSlug();
  if (slug) {
    await loadPublic(slug);
    return;
  }

  try {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      const ok = await carregarConta(session.user);
      if (!ok) {
        await db.auth.signOut();
      }
    }
  } catch (e) {
    console.error('Erro ao verificar sessão:', e);
  }
}

function getPublicSlug() {
  if (location.hash.startsWith('#agendar/')) {
    return location.hash.replace('#agendar/', '').trim();
  }
  return null;
}

async function carregarConta(user) {
  try {
    const { data: perfil, error: pe } = await db.from('agenda_perfis')
      .select('*').eq('auth_user_id', user.id).single();
    if (pe || !perfil) { console.warn('Perfil não encontrado para', user.id); return false; }

    const { data: empresa, error: ee } = await db.from('agenda_empresas')
      .select('*').eq('id', perfil.empresa_id).single();
    if (ee || !empresa) { console.warn('Empresa não encontrada para perfil', perfil.id); return false; }

    state.user = user;
    state.perfil = perfil;
    state.empresa = empresa;
    showDashboard();
    await loadAll();
    return true;
  } catch (e) {
    console.error('Erro em carregarConta:', e);
    return false;
  }
}

// ── CARREGAR CATEGORIAS ──
async function loadCategorias() {
  try {
    const { data, error } = await db.from('agenda_categorias').select('*').order('nome');
    if (error) {
      console.warn('Erro ao carregar categorias:', error.message);
      state.categorias = [];
    } else {
      state.categorias = data || [];
    }
  } catch (e) {
    console.warn('Exceção ao carregar categorias:', e);
    state.categorias = [];
  }
  preencherSelectCategorias();
}

function preencherSelectCategorias() {
  const sel = $('empCategoria');
  if (!sel) return;

  if (!state.categorias || state.categorias.length === 0) {
    const fallback = [
      { id: 'beleza', nome: 'Beleza & Estética', icone: '💅' },
      { id: 'saude', nome: 'Saúde', icone: '🏥' },
      { id: 'barbearia', nome: 'Barbearia', icone: '✂️' },
      { id: 'fitness', nome: 'Fitness & Bem-estar', icone: '🏋️' },
      { id: 'tatuagem', nome: 'Tatuagem & Piercing', icone: '🎨' },
      { id: 'pet', nome: 'Pet Shop', icone: '🐾' },
      { id: 'educacao', nome: 'Educação', icone: '📚' },
      { id: 'consultoria', nome: 'Consultoria', icone: '💼' },
      { id: 'fotografia', nome: 'Fotografia', icone: '📸' },
      { id: 'outro', nome: 'Outro', icone: '✦' }
    ];
    sel.innerHTML = fallback.map(c =>
      `<option value="${c.id}">${c.icone} ${c.nome}</option>`
    ).join('');
  } else {
    sel.innerHTML = state.categorias.map(c =>
      `<option value="${c.id}">${c.icone || ''} ${c.nome}</option>`
    ).join('');
  }
}

// ── SHOW DASHBOARD ──
function showDashboard() {
  const lv = $('landingView');
  const dv = $('dashboardView');
  const pv = $('publicView');
  if (lv) lv.style.display = 'none';
  if (dv) dv.style.display = 'block';
  if (pv) pv.style.display = 'none';

  closeAuth();

  if (state.empresa) {
    setText('sideAvatar', initial(state.empresa.nome));
    setText('sideNome', state.empresa.nome);
    setText('sidePlan', state.empresa.plano || 'Grátis');
    const lb = $('sideLinkBox');
    if (lb) lb.textContent = publicUrl(state.empresa.slug);
  }

  document.body.style.overflow = '';
  setView('dashboard');
  setupRealtime();
  startAutoSync();
}

function openMobileMenu() {
  const overlay = $('mobileMenuOverlay');
  const drawer = $('mobileMenuDrawer');
  if (overlay) overlay.classList.add('open');
  if (drawer) drawer.classList.add('open');
  document.body.classList.add('menu-open');
}

function closeMobileMenu() {
  const overlay = $('mobileMenuOverlay');
  const drawer = $('mobileMenuDrawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.classList.remove('open');
  document.body.classList.remove('menu-open');
}

function menuOpenPublic() { closeMobileMenu(); openPublic(); }
function menuCopyPublicLink() { closeMobileMenu(); copyPublicLink(); }
function menuNotifications() {
  closeMobileMenu(); clearNotifDot();
  const stack = $('notifStack');
  if (stack) stack.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── VIEW NAVIGATION ──
function setView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = $('view-' + view);
  if (target) target.classList.add('active');

  const navMap = {
    dashboard: ['Dashboard', 'Controle completo do seu negócio.'],
    agenda: ['Agenda', 'Criar e acompanhar horários.'],
    clientes: ['Clientes', 'Cadastro de clientes.'],
    servicos: ['Serviços', 'Catálogo e preços.'],
    profissionais: ['Profissionais', 'Equipe de atendimento.'],
    financeiro: ['Financeiro', 'Valores e resultados.'],
    relatorios: ['Relatórios', 'Dados e métricas.'],
    config: ['Configurações', 'Dados do negócio.']
  };
  const info = navMap[view] || ['', ''];
  setText('pageTitle', info[0]);
  setText('pageSub', info[1]);

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', (b.getAttribute('onclick') || '').includes(`'${view}'`));
  });
  document.querySelectorAll('.mob-nav-btn').forEach(b => {
    b.classList.toggle('active', (b.getAttribute('onclick') || '').includes(`'${view}'`));
  });
}

// ── AUTH ──
function openAuth(mode) {
  const overlay = $('authOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (mode === 'login') showLogin();
  else showCadastro();
}

function closeAuth() {
  const overlay = $('authOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function showLogin() {
  const fl = $('formLogin');
  const fc = $('formCadastro');
  if (fl) fl.style.display = 'block';
  if (fc) fc.style.display = 'none';

  ['step1','step2','step3'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = id === 'step1' ? 'block' : 'none';
  });
  setStep(1);
}

function showCadastro() {
  const fl = $('formLogin');
  const fc = $('formCadastro');
  if (fl) fl.style.display = 'none';
  if (fc) fc.style.display = 'block';

  const s1 = $('step1'), s2 = $('step2'), s3 = $('step3');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  if (s3) s3.style.display = 'none';

  setStep(1);
  preencherSelectCategorias();
}

function setStep(n) {
  ['st1', 'st2', 'st3'].forEach((id, i) => {
    const el = $(id);
    if (!el) return;
    el.className = 'step-dot' + (i + 1 === n ? ' active' : i + 1 < n ? ' done' : '');
  });
}

function goStep2() {
  const nome = $('cadNome')?.value?.trim();
  const email = $('cadEmail')?.value?.trim();
  const senha = $('cadSenha')?.value?.trim();
  if (!nome || !email || !senha) return toast('Preencha nome, e-mail e senha.', 'err');
  if (senha.length < 6) return toast('Senha mínimo 6 caracteres.', 'err');

  const s1 = $('step1'), s2 = $('step2'), s3 = $('step3');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'block';
  if (s3) s3.style.display = 'none';

  setStep(2);
  preencherSelectCategorias();
}

function goStep1() {
  const s1 = $('step1'), s2 = $('step2'), s3 = $('step3');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  if (s3) s3.style.display = 'none';
  setStep(1);
}

function goStep3() {
  const empNome = $('empNome')?.value?.trim();
  const empSlug = $('empSlug')?.value?.trim();
  const empWhatsapp = $('empWhatsapp')?.value?.trim();
  if (!empNome || !empSlug || !empWhatsapp) {
    return toast('Preencha nome, link e WhatsApp.', 'err');
  }

  const s1 = $('step1'), s2 = $('step2'), s3 = $('step3');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'none';
  if (s3) s3.style.display = 'block';

  setStep(3);
}

function autoSlug() {
  const el = $('empSlug');
  if (!el || el.dataset.manual === '1') return;
  const nomeEl = $('empNome');
  if (nomeEl) el.value = slugify(nomeEl.value || '');
}

document.addEventListener('input', function(e) {
  if (e.target && e.target.id === 'empSlug') {
    e.target.dataset.manual = '1';
  }
});

// ── LOGIN ──
async function loginComSenha() {
  const email = ($('loginEmail')?.value || '').trim();
  const senha = ($('loginSenha')?.value || '').trim();
  if (!email || !senha) return toast('Digite e-mail e senha.', 'err');

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
    if (error || !data.user) return toast(error?.message || 'E-mail ou senha incorretos.', 'err');

    const ok = await carregarConta(data.user);
    if (!ok) {
      await db.auth.signOut();
      return toast('Perfil ou empresa não encontrado. Refaça o cadastro.', 'err');
    }
    showNotif('Login realizado!', 'Bem-vindo de volta.', 'ok', 4000);
  } catch (e) {
    console.error('Erro no login:', e);
    toast('Erro ao fazer login. Tente novamente.', 'err');
  }
}

// ── CADASTRO ──
async function finalizarCadastro() {
  const servNome = $('servNome')?.value?.trim();
  const servPreco = $('servPreco')?.value;
  const servDuracao = $('servDuracao')?.value;
  const profNomeVal = $('profNome')?.value?.trim();

  if (!servNome || !servPreco || !servDuracao || !profNomeVal) {
    return toast('Preencha serviço, preço, duração e profissional.', 'err');
  }

  const email = ($('cadEmail')?.value || '').trim();
  const senha = ($('cadSenha')?.value || '').trim();
  const nomeUser = ($('cadNome')?.value || '').trim();
  const empNomeVal = ($('empNome')?.value || '').trim();
  const empSlugVal = slugify($('empSlug')?.value || empNomeVal);
  const empWhatsappVal = ($('empWhatsapp')?.value || '').trim();

  const catSelect = $('empCategoria');
  const areaAtuacao = catSelect
    ? (catSelect.options[catSelect.selectedIndex]?.textContent?.trim() || 'Outro')
    : 'Outro';

  const btnFin = $('btnFinalizar');
  if (btnFin) { btnFin.disabled = true; btnFin.textContent = 'Criando...'; }

  try {
    const { data: authData, error: authErr } = await db.auth.signUp({
      email,
      password: senha,
      options: { data: { nome: nomeUser } }
    });

    if (authErr) {
      if (btnFin) { btnFin.disabled = false; btnFin.textContent = 'Criar painel →'; }
      if (authErr.message && authErr.message.toLowerCase().includes('already registered')) {
        return toast('Este e-mail já está cadastrado. Faça login.', 'err');
      }
      return toast('Erro ao criar conta: ' + authErr.message, 'err');
    }

    if (!authData?.user) {
      if (btnFin) { btnFin.disabled = false; btnFin.textContent = 'Criar painel →'; }
      return toast('Erro ao criar conta. Tente novamente.', 'err');
    }

    const user = authData.user;

    const { data: slugExiste } = await db.from('agenda_empresas')
      .select('id').eq('slug', empSlugVal).maybeSingle();
    const slugFinal = slugExiste ? empSlugVal + '-' + Date.now().toString().slice(-4) : empSlugVal;

    const { data: empresa, error: errEmp } = await db.from('agenda_empresas').insert({
      nome: empNomeVal,
      slug: slugFinal,
      area_atuacao: areaAtuacao,
      whatsapp: empWhatsappVal,
      email: email,
      plano: 'Grátis',
      onboarding_finalizado: true
    }).select('*').single();

    if (errEmp || !empresa) {
      console.error('Erro ao criar empresa:', errEmp);
      if (btnFin) { btnFin.disabled = false; btnFin.textContent = 'Criar painel →'; }
      return toast('Erro ao criar empresa: ' + (errEmp?.message || 'tente novamente.'), 'err');
    }

    const { error: perfilErr } = await db.from('agenda_perfis').insert({
      auth_user_id: user.id,
      empresa_id: empresa.id,
      nome: nomeUser,
      email: email,
      whatsapp: empWhatsappVal,
      cargo: 'Administrador'
    });

    if (perfilErr) {
      console.error('Erro ao criar perfil:', perfilErr);
    }

    await db.from('agenda_servicos').insert({
      empresa_id: empresa.id,
      nome: servNome,
      preco: Number(servPreco || 0),
      duracao_minutos: Number(servDuracao || 60),
      status: 'ativo',
      descricao: 'Serviço inicial.'
    });

    await db.from('agenda_profissionais').insert({
      empresa_id: empresa.id,
      nome: profNomeVal,
      especialidade: ($('profEsp')?.value || 'Profissional').trim(),
      telefone: empWhatsappVal,
      status: 'ativo'
    });

    const { data: loginData, error: loginErr } = await db.auth.signInWithPassword({
      email,
      password: senha
    });

    if (loginErr || !loginData?.user) {
      if (btnFin) { btnFin.disabled = false; btnFin.textContent = 'Criar painel →'; }
      closeAuth();
      toast('Conta criada! Faça login para acessar.', 'ok');
      setTimeout(() => openAuth('login'), 1500);
      return;
    }

    state.user = loginData.user;
    state.perfil = { auth_user_id: loginData.user.id, empresa_id: empresa.id, nome: nomeUser, email };
    state.empresa = empresa;
    showDashboard();
    await loadAll();
    showNotif('Bem-vindo ao AgendaPro!', empresa.nome + ' — painel criado com sucesso.', 'ok', 7000);

  } catch (e) {
    console.error('Erro em finalizarCadastro:', e);
    if (btnFin) { btnFin.disabled = false; btnFin.textContent = 'Criar painel →'; }
    toast('Erro inesperado. Verifique o console e tente novamente.', 'err');
  }
}

async function logout() {
  try {
    if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
    if (realtimeChannel) {
      try { db.removeChannel(realtimeChannel); } catch(e) {}
      realtimeChannel = null;
    }
    await db.auth.signOut();
  } catch(e) {}
  state.user = null; state.perfil = null; state.empresa = null;
  state.clientes = []; state.servicos = []; state.profissionais = [];
  state.agendamentos = []; state.pagamentos = [];
  location.href = location.pathname;
}

// ── REALTIME ──
function setupRealtime() {
  if (!state?.empresa?.id || !db?.channel) return;
  if (realtimeChannel) {
    try { db.removeChannel(realtimeChannel); } catch(e) {}
    realtimeChannel = null;
  }
  const id = state.empresa.id;
  const tables = ['agenda_agendamentos', 'agenda_clientes', 'agenda_servicos', 'agenda_profissionais'];
  let ch = db.channel('ap-realtime-' + id);
  tables.forEach(table => {
    ch = ch.on('postgres_changes', {
      event: '*', schema: 'public', table,
      filter: `empresa_id=eq.${id}`
    }, payload => {
      if (table === 'agenda_agendamentos' && payload.eventType === 'INSERT') {
        showNotif('Novo agendamento!', `${payload.new?.cliente_nome || 'Cliente'} acabou de agendar.`, 'new', 6000);
      }
      scheduleReload();
    });
  });
  realtimeChannel = ch.subscribe();
}

let _reloadTimer = null;
function scheduleReload() {
  if (_reloadTimer) clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(async () => {
    if (state?.empresa?.id) await loadAll();
  }, 400);
}

function startAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  lastIds = new Set((state.agendamentos || []).map(a => String(a.id)));
  autoSyncTimer = setInterval(async () => {
    if (!state?.empresa?.id) return;
    try {
      const { data } = await db.from('agenda_agendamentos').select('*')
        .eq('empresa_id', state.empresa.id)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });
      const novos = (data || []).filter(a => !lastIds.has(String(a.id)));
      state.agendamentos = data || [];
      if (novos.length) {
        novos.forEach(a => showNotif('Novo agendamento!', `${a.cliente_nome || 'Cliente'} agendou.`, 'new', 6000));
      }
      lastIds = new Set(state.agendamentos.map(a => String(a.id)));
      renderAll();
    } catch (e) {}
  }, 5000);
}

function preserveAgendaFormValues(callback) {
  const values = {
    cliente: $('agCliente')?.value || '',
    telefone: $('agTelefone')?.value || '',
    servico: $('agServico')?.value || '',
    profissional: $('agProfissional')?.value || '',
    data: $('agData')?.value || '',
    hora: $('agHora')?.value || '',
    status: $('agStatus')?.value || ''
  };

  if (typeof callback === 'function') callback();

  if ($('agCliente') && values.cliente) $('agCliente').value = values.cliente;
  if ($('agTelefone') && values.telefone) $('agTelefone').value = values.telefone;
  if ($('agServico') && values.servico && [...$('agServico').options].some(o => o.value === values.servico)) $('agServico').value = values.servico;
  if ($('agProfissional') && values.profissional && [...$('agProfissional').options].some(o => o.value === values.profissional)) $('agProfissional').value = values.profissional;
  if ($('agData') && values.data) $('agData').value = values.data;
  if ($('agHora') && values.hora) $('agHora').value = values.hora;
  if ($('agStatus') && values.status) $('agStatus').value = values.status;
}

// ── LOAD ALL ──
async function loadAll() {
  if (!state.empresa) return;
  const id = state.empresa.id;
  try {
    const [cli, svc, prof, ag, pag] = await Promise.all([
      db.from('agenda_clientes').select('*').eq('empresa_id', id).order('criado_em', { ascending: false }),
      db.from('agenda_servicos').select('*').eq('empresa_id', id).order('criado_em', { ascending: false }),
      db.from('agenda_profissionais').select('*').eq('empresa_id', id).order('criado_em', { ascending: false }),
      db.from('agenda_agendamentos').select('*').eq('empresa_id', id).order('data', { ascending: true }).order('hora', { ascending: true }),
      db.from('agenda_pagamentos').select('*').eq('empresa_id', id).order('criado_em', { ascending: false })
    ]);
    state.clientes = cli.data || [];
    state.servicos = svc.data || [];
    state.profissionais = prof.data || [];
    state.agendamentos = ag.data || [];
    state.pagamentos = pag.data || [];
    lastIds = new Set(state.agendamentos.map(a => String(a.id)));
    renderAll();
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
  }
}

function isEditingConfig() {
  const active = document.activeElement;
  if (!active) return false;
  return !!active.closest('#view-config');
}

function renderAll() {
  preserveAgendaFormValues(() => {
    renderStats();
    renderDashList();
    renderCalendar();
    renderSelects();
    renderTimeline();
    renderClientes();
    renderServicos();
    renderProfissionais();
    renderFinanceiro();

    const active = document.activeElement;
    const editingConfig = active && active.closest && active.closest('#view-config');
    if (!editingConfig) renderConfig();
  });
}

// ── STATS ──
function renderStats() {
  const hoje = hojeISO(), mes = mesPrefixo(), ags = state.agendamentos || [];
  const ativos = ags.filter(a => normStatus(a.status) !== 'Excluído');
  const st = s => ativos.filter(a => normStatus(a.status) === s).length;
  const stAll = s => ags.filter(a => normStatus(a.status) === s).length;
  const concluidos = st('Concluído');
  const base = ativos.filter(a => normStatus(a.status) !== 'Recusado').length;
  const taxa = base > 0 ? Math.round(concluidos / base * 100) : 0;
  const fin = ags.filter(isFinanceiro);
  const fatHoje = fin.filter(a => a.data === hoje).reduce((s, a) => s + Number(a.valor || 0), 0);
  const fatMes = fin.filter(a => (a.data || '').startsWith(mes)).reduce((s, a) => s + Number(a.valor || 0), 0);

  setText('statHoje', ativos.filter(a => a.data === hoje).length);
  setText('statPendentes', st('Pendente'));
  setText('statConfirmados', st('Confirmado'));
  setText('statReagendados', st('Reagendado'));
  setText('statConcluidos', concluidos);
  setText('statRecusados', st('Recusado'));
  setText('statExcluidos', stAll('Excluído'));
  setText('statTaxa', taxa + '%');
  setText('statFatHoje', money(fatHoje).replace(',00', ''));
  setText('statFatMes', money(fatMes).replace(',00', ''));
  setText('statClientes', (state.clientes || []).filter(isAtivoCliente).length);
  setText('statServicos', (state.servicos || []).filter(s => s.status === 'ativo').length);
  setText('statProfissionais', (state.profissionais || []).filter(p => p.status === 'ativo').length);
  setText('statTotal', ativos.length);
  setText('fc-todos', ativos.length);
  setText('fc-pendente', st('Pendente'));
  setText('fc-confirmado', st('Confirmado'));
  setText('fc-reagendado', st('Reagendado'));
  setText('fc-concluido', concluidos);
  setText('fc-recusado', st('Recusado'));
  setText('fc-excluido', stAll('Excluído'));
}

// ── DASHBOARD LIST ──
function renderDashList() {
  const el = $('dashAptList');
  if (!el) return;
  const visibles = (state.agendamentos || [])
    .filter(a => ['Pendente', 'Confirmado', 'Reagendado'].includes(normStatus(a.status)))
    .slice(0, 6);
  if (!visibles.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon">📅</div><p>Nenhum agendamento pendente.</p></div>';
    return;
  }
  el.innerHTML = visibles.map(a => `
    <div class="apt-item">
      <div class="apt-row">
        <div class="apt-av">${initial(a.cliente_nome)}</div>
        <div class="apt-info">
          <div class="apt-name">${a.cliente_nome || 'Cliente'}</div>
          <div class="apt-meta">${a.servico_nome || '—'} · ${a.profissional_nome || '—'} · ${formatDate(a.data)} ${a.hora || ''}</div>
        </div>
        <span class="badge ${badgeClass(a.status)}">${normStatus(a.status)}</span>
      </div>
      ${renderAcoes(a)}
    </div>`).join('');
}

// ── CALENDAR ──
function renderCalendar() {
  const el = $('calGrid');
  if (!el) return;
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const busy = new Set(
    (state.agendamentos || [])
      .filter(a => normStatus(a.status) !== 'Excluído')
      .map(a => String(new Date((a.data || '') + 'T00:00:00').getDate()))
  );
  const today = String(new Date().getDate());
  let html = days.map(d => `<div class="cal-label">${d}</div>`).join('');
  for (let i = 1; i <= 28; i++) {
    const d = String(i);
    html += `<div class="cal-day${busy.has(d) ? ' busy' : ''}${d === today ? ' today' : ''}">${i}</div>`;
  }
  el.innerHTML = html;
}

// ── SELECTS ──
function renderSelects() {
  const agS = $('agServico');
  const agP = $('agProfissional');

  const selectedServico = agS ? agS.value : '';
  const selectedProfissional = agP ? agP.value : '';

  if (agS) {
    agS.innerHTML =
      '<option value="">Escolha serviço</option>' +
      (state.servicos || [])
        .filter(s => (s.status || 'ativo') === 'ativo')
        .map(s => `<option value="${s.id}">${s.nome} — ${money(s.preco).replace(',00','')}</option>`)
        .join('');

    if (selectedServico && [...agS.options].some(o => o.value === selectedServico)) {
      agS.value = selectedServico;
    }
  }

  if (agP) {
    agP.innerHTML =
      '<option value="">Escolha profissional</option>' +
      (state.profissionais || [])
        .filter(p => (p.status || 'ativo') === 'ativo')
        .map(p => `<option value="${p.id}">${p.nome}</option>`)
        .join('');

    if (selectedProfissional && [...agP.options].some(o => o.value === selectedProfissional)) {
      agP.value = selectedProfissional;
    }
  }
}

// ── FILTER ──
function setFilter(filter, btn) {
  _agendaFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTimeline();
}

// ── TIMELINE ──
function renderTimeline() {
  const el = $('agendaTimeline');
  if (!el) return;

  const ags = state.agendamentos || [];

  const statusMap = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    reagendado: 'Reagendado',
    concluido: 'Concluído',
    recusado: 'Recusado',
    excluido: 'Excluído'
  };

  let filtered;
  if (_agendaFilter === 'excluido') {
    filtered = ags.filter(a => normStatus(a.status) === 'Excluído');
  } else if (_agendaFilter !== 'todos') {
    const target = statusMap[_agendaFilter];
    filtered = ags.filter(a => normStatus(a.status) === target);
  } else {
    filtered = ags.filter(a => normStatus(a.status) !== 'Excluído');
  }

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">📅</div><p>Nenhum agendamento neste filtro.</p></div>';
    return;
  }

  el.innerHTML = '';

  filtered.forEach(a => {
    const block = document.createElement('div');
    block.className = 'tl-block agenda-premium-block';
    block.id = 'ag-' + a.id;

    const telefone = a.cliente_telefone || a.telefone || '—';
    const dataTxt = formatDate(a.data);
    const horaTxt = a.hora || '—';
    const statusTxt = normStatus(a.status);

    block.innerHTML = `
      <div class="tl-time agenda-time-pill">${horaTxt}</div>
      <div class="tl-content agenda-content">
        <div class="tl-card agenda-premium-card">
          <div class="agenda-main-row">
            <div class="apt-av agenda-avatar">${initial(a.cliente_nome)}</div>

            <div class="agenda-main-info">
              <div class="agenda-title-line">
                <div class="tl-card-name agenda-client-name">${a.cliente_nome || 'Cliente'}</div>
                <span class="badge ${badgeClass(a.status)}">${statusTxt}</span>
              </div>

              <div class="agenda-info-grid">
                <div class="agenda-info-item"><span>Serviço</span><b>${a.servico_nome || '—'}</b></div>
                <div class="agenda-info-item"><span>Profissional</span><b>${a.profissional_nome || '—'}</b></div>
                <div class="agenda-info-item"><span>Data</span><b>${dataTxt}</b></div>
                <div class="agenda-info-item"><span>WhatsApp</span><b>${telefone}</b></div>
              </div>
            </div>
          </div>

          ${renderAcoes(a)}
        </div>
      </div>
    `;

    const card = block.querySelector('.tl-card');
    const menu = buildActionMenu(a.id, [
      { icon: '✏️', label: 'Editar', action: () => editAgendamento(a.id) },
      { icon: '📋', label: 'Duplicar', action: () => duplicarAgendamento(a.id) },
      'sep',
      { icon: '🗑', label: 'Excluir', cls: 'danger', action: () => excluirAgendamento(a.id) }
    ]);

    if (card) card.appendChild(menu);
    el.appendChild(block);
  });
}

// ── RENDER ACOES ──
function renderAcoes(a) {
  const tel = (a.cliente_telefone || a.telefone || '').replace(/\D/g, '');
  const s = normStatus(a.status);
  if (s === 'Excluído') {
    return `<div class="apt-actions muted-actions"><span class="badge badge-gray">🗑 Excluído</span></div>`;
  }
  if (s === 'Recusado') {
    return `<div class="apt-actions muted-actions"><span class="badge badge-red">✕ Recusado</span></div>`;
  }
  if (s === 'Concluído') {
    return `<div class="apt-actions muted-actions">
      <span class="badge badge-blue">✓ Concluído</span>
      ${tel ? `<button class="act-btn whatsapp" onclick="abrirWA('${a.id}')">💬 WA</button>` : ''}
      <button class="act-btn refuse" onclick="excluirAgendamento('${a.id}')">🗑 Arquivar</button>
    </div>`;
  }
  return `<div class="apt-actions">
    ${s !== 'Confirmado' ? `<button class="act-btn confirm" onclick="confirmarAg('${a.id}')">✅ Confirmar</button>` : ''}
    <button class="act-btn refuse" onclick="openModalRecusa('${a.id}')">✕ Recusar</button>
    <button class="act-btn reschedule" onclick="openModalReagendar('${a.id}')">📅 Reagendar</button>
    <button class="act-btn conclude" onclick="concluirAg('${a.id}')">✓ Concluir</button>
    ${tel ? `<button class="act-btn whatsapp" onclick="abrirWA('${a.id}')">💬 WA</button>` : ''}
  </div>`;
}

// ── ACTION MENU — FIX COMPLETO ──
// Usa position:fixed com coordenadas calculadas do getBoundingClientRect
// para que o dropdown nunca seja cortado por qualquer overflow:hidden do pai
function buildActionMenu(id, items) {
  const wrap = document.createElement('div');
  wrap.className = 'action-menu';

  const btn = document.createElement('button');
  btn.className = 'action-menu-btn';
  btn.innerHTML = '⋮';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Ações');

  const drop = document.createElement('div');
  drop.className = 'action-dropdown';

  items.forEach(item => {
    if (item === 'sep') {
      const s = document.createElement('div');
      s.className = 'action-sep';
      drop.appendChild(s);
      return;
    }

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'action-item' + (item.cls ? ' ' + item.cls : '');
    el.innerHTML = `<span class="action-item-icon">${item.icon || ''}</span>${item.label || ''}`;
    el.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      closeAllMenus();
      if (typeof item.action === 'function') item.action();
    });
    drop.appendChild(el);
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();

    if (_openMenu === drop) {
      closeAllMenus();
      return;
    }

    closeAllMenus();

    if (drop.parentElement !== document.body) {
      document.body.appendChild(drop);
    }

    drop.classList.add('open');

    const rect = btn.getBoundingClientRect();
    const dropW = Math.min(230, window.innerWidth - 24);
    const dropH = Math.min(260, window.innerHeight - 24);

    let left = rect.right - dropW;
    let top = rect.bottom + 8;

    if (left < 12) left = 12;
    if (left + dropW > window.innerWidth - 12) left = window.innerWidth - dropW - 12;

    if (top + dropH > window.innerHeight - 12) {
      top = rect.top - dropH - 8;
    }
    if (top < 12) top = 12;

    drop.style.position = 'fixed';
    drop.style.left = left + 'px';
    drop.style.top = top + 'px';
    drop.style.width = dropW + 'px';
    drop.style.maxHeight = dropH + 'px';

    _openMenu = drop;
    _openMenuBtn = btn;
  });

  wrap.appendChild(btn);
  return wrap;
}

function closeAllMenus() {
  document.querySelectorAll('.action-dropdown.open').forEach(d => {
    d.classList.remove('open');
    if (d.parentElement === document.body) {
      document.body.removeChild(d);
    }
  });
  _openMenu = null;
  _openMenuBtn = null;
}

// ── CLIENTES ──
function renderClientes() {
  const el = $('clientesGrid');
  if (!el) return;
  const clientes = state.clientes || [];
  if (!clientes.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">👥</div><p>Nenhum cliente ainda.</p></div>';
    return;
  }
  el.innerHTML = '';
  clientes.forEach(c => {
    const agts = (state.agendamentos || []).filter(a => a.cliente_nome === c.nome && normStatus(a.status) !== 'Excluído').length;
    const gasto = (state.agendamentos || []).filter(a => a.cliente_nome === c.nome && isFinanceiro(a)).reduce((s, a) => s + Number(a.valor || 0), 0);
    const ativo = isAtivoCliente(c);
    const card = document.createElement('div');
    card.className = 'client-card' + (ativo ? '' : ' inactive');
    card.innerHTML = `
      <div class="cc-top">
        <div class="cc-av">${initial(c.nome)}</div>
        <div style="flex:1;min-width:0"><div class="cc-name">${c.nome}</div><div class="cc-phone">${c.telefone || '—'}</div></div>
      </div>
      ${c.email ? `<div style="font-size:11.5px;color:var(--text4);margin-bottom:8px;word-break:break-all">✉ ${c.email}</div>` : ''}
      <div style="margin-bottom:9px"><span class="badge ${ativo ? 'badge-green' : 'badge-gray'}">${ativo ? 'Ativo' : 'Inativo'}</span></div>
      <div class="cc-stats">
        <div class="cc-stat"><div class="cc-sl">Atendimentos</div><div class="cc-sv">${agts}</div></div>
        <div class="cc-stat"><div class="cc-sl">Total gasto</div><div class="cc-sv" style="font-size:14px">${money(gasto).replace(',00', '')}</div></div>
      </div>`;
    const menu = buildActionMenu(c.id, [
      { icon: '✏️', label: 'Editar', action: () => editCliente(c.id) },
      { icon: '📋', label: 'Duplicar', action: () => duplicarCliente(c.id) },
      'sep',
      ativo
        ? { icon: '⏸', label: 'Desativar', cls: 'danger', action: () => toggleCliente(c.id, false) }
        : { icon: '▶️', label: 'Ativar', cls: 'success', action: () => toggleCliente(c.id, true) },
      { icon: '🗑', label: 'Excluir', cls: 'danger', action: () => excluirCliente(c.id) }
    ]);
    card.appendChild(menu);
    el.appendChild(card);
  });
}

// ── SERVIÇOS ──
function renderServicos() {
  const el = $('servicosGrid');
  if (!el) return;
  const vis = (state.servicos || []).filter(s => s.status !== 'excluido');
  if (!vis.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">✦</div><p>Nenhum serviço ainda.</p></div>';
    return;
  }
  el.innerHTML = '';
  vis.forEach(s => {
    const ativo = s.status === 'ativo';
    const card = document.createElement('div');
    card.className = 'svc-card' + (ativo ? '' : ' inactive');
    card.innerHTML = `
      <div class="svc-price">${money(s.preco).replace(',00', '')}</div>
      <div class="svc-name">${s.nome}</div>
      <div class="svc-dur">⏱ ${s.duracao_minutos || 60} min</div>
      <div class="svc-status"><span class="badge ${ativo ? 'badge-green' : 'badge-gray'}">${ativo ? 'Ativo' : 'Inativo'}</span></div>`;
    const menu = buildActionMenu(s.id, [
      { icon: '✏️', label: 'Editar', action: () => editServico(s.id) },
      { icon: '📋', label: 'Duplicar', action: () => duplicarServico(s.id) },
      'sep',
      ativo
        ? { icon: '⏸', label: 'Desativar', cls: 'danger', action: () => toggleServico(s.id, 'inativo') }
        : { icon: '▶️', label: 'Ativar', cls: 'success', action: () => toggleServico(s.id, 'ativo') },
      { icon: '🗑', label: 'Excluir', cls: 'danger', action: () => excluirServico(s.id) }
    ]);
    card.appendChild(menu);
    el.appendChild(card);
  });
}

// ── PROFISSIONAIS ──
function renderProfissionais() {
  const el = $('profGrid');
  if (!el) return;
  const vis = (state.profissionais || []).filter(p => p.status !== 'excluido');
  if (!vis.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">👤</div><p>Nenhum profissional ainda.</p></div>';
    return;
  }
  el.innerHTML = '';
  vis.forEach(p => {
    const ativo = p.status === 'ativo';
    const card = document.createElement('div');
    card.className = 'prof-card' + (ativo ? '' : ' inactive');
    card.innerHTML = `
      <div class="prof-av">${initial(p.nome)}</div>
      <div class="prof-name">${p.nome}</div>
      <div class="prof-esp">${p.especialidade || 'Profissional'}</div>
      ${p.telefone ? `<div class="prof-phone">📱 ${p.telefone}</div>` : ''}
      <div class="online-dot${ativo ? '' : ' off'}">${ativo ? 'Online' : 'Offline'}</div>`;
    const menu = buildActionMenu(p.id, [
      { icon: '✏️', label: 'Editar', action: () => editProfissional(p.id) },
      { icon: '📋', label: 'Duplicar', action: () => duplicarProfissional(p.id) },
      'sep',
      ativo
        ? { icon: '⏸', label: 'Desativar', cls: 'danger', action: () => toggleProfissional(p.id, 'inativo') }
        : { icon: '▶️', label: 'Ativar', cls: 'success', action: () => toggleProfissional(p.id, 'ativo') },
      { icon: '🗑', label: 'Excluir', cls: 'danger', action: () => excluirProfissional(p.id) }
    ]);
    card.appendChild(menu);
    el.appendChild(card);
  });
}

// ── FINANCEIRO ──
function renderFinanceiro() {
  const fin = (state.agendamentos || []).filter(isFinanceiro);
  const total = fin.reduce((s, a) => s + Number(a.valor || 0), 0);
  const ticket = fin.length ? total / fin.length : 0;
  setText('finReceita', money(total).replace(',00', ''));
  setText('finTicket', money(ticket).replace(',00', ''));
  setText('finPagos', fin.length);
  setText('finPlano', state.empresa?.plano || 'Grátis');
}

// ── CONFIG ──
function renderConfig() {
  const e = state.empresa || {};
  const set = (id, v) => { const el = $(id); if (el) el.value = v || ''; };
  set('cfgNome', e.nome);
  set('cfgWhatsapp', e.whatsapp);
  set('cfgSlug', e.slug);
  set('cfgEndereco', e.endereco);
  set('cfgCidade', e.cidade);
  set('cfgInstagram', e.instagram);
  set('cfgFacebook', e.facebook);
  set('cfgTiktok', e.tiktok);
  set('cfgSite', e.site);
  const lb = $('cfgLinkBox');
  if (lb) lb.textContent = '🔗 ' + publicUrl(e.slug || '');
}

// ── SALVAR ──
async function salvarCliente() {
  const nome = ($('cliNome')?.value || '').trim();
  if (!nome) return toast('Digite o nome.', 'err');
  const { error } = await db.from('agenda_clientes').insert({
    empresa_id: state.empresa.id, nome,
    telefone: ($('cliTel')?.value || '').trim(),
    email: ($('cliEmail')?.value || '').trim(),
    status: 'ativo'
  });
  if (error) return toast('Erro ao salvar: ' + error.message, 'err');
  if ($('cliNome')) $('cliNome').value = '';
  if ($('cliTel')) $('cliTel').value = '';
  if ($('cliEmail')) $('cliEmail').value = '';
  await loadAll();
  showNotif('Cliente adicionado', nome + ' salvo com sucesso.', 'ok');
}

async function salvarServico() {
  const nome = ($('srvNome')?.value || '').trim();
  if (!nome) return toast('Digite o nome.', 'err');
  const { error } = await db.from('agenda_servicos').insert({
    empresa_id: state.empresa.id, nome,
    preco: Number($('srvPreco')?.value || 0),
    duracao_minutos: Number($('srvDur')?.value || 60),
    status: 'ativo'
  });
  if (error) return toast('Erro ao salvar: ' + error.message, 'err');
  if ($('srvNome')) $('srvNome').value = '';
  if ($('srvPreco')) $('srvPreco').value = '';
  if ($('srvDur')) $('srvDur').value = '';
  await loadAll();
  showNotif('Serviço adicionado', '', 'ok');
}

async function salvarProfissional() {
  const nome = ($('proNome')?.value || '').trim();
  if (!nome) return toast('Digite o nome.', 'err');
  const { error } = await db.from('agenda_profissionais').insert({
    empresa_id: state.empresa.id, nome,
    especialidade: ($('proEsp')?.value || '').trim(),
    telefone: ($('proTel')?.value || '').trim(),
    status: 'ativo'
  });
  if (error) return toast('Erro ao salvar: ' + error.message, 'err');
  if ($('proNome')) $('proNome').value = '';
  if ($('proEsp')) $('proEsp').value = '';
  if ($('proTel')) $('proTel').value = '';
  await loadAll();
  showNotif('Profissional adicionado', '', 'ok');
}

async function salvarAgendamento() {
  const agCli = $('agCliente')?.value?.trim();
  const agSvc = $('agServico')?.value;
  const agProf = $('agProfissional')?.value;
  const agData = $('agData')?.value;
  const agHora = $('agHora')?.value;
  if (!agCli || !agSvc || !agProf || !agData || !agHora) {
    return toast('Preencha todos os campos.', 'err');
  }
  const serv = (state.servicos || []).find(s => s.id === agSvc);
  const prof = (state.profissionais || []).find(p => p.id === agProf);

  let clienteId = null;
  try {
    const { data: cli } = await db.from('agenda_clientes').insert({
      empresa_id: state.empresa.id,
      nome: agCli,
      telefone: ($('agTelefone')?.value || '').trim(),
      status: 'ativo'
    }).select('*').single();
    if (cli) clienteId = cli.id;
  } catch(e) {}

  const { error } = await db.from('agenda_agendamentos').insert({
    empresa_id: state.empresa.id,
    cliente_id: clienteId,
    servico_id: serv?.id || null,
    profissional_id: prof?.id || null,
    cliente_nome: agCli,
    cliente_telefone: ($('agTelefone')?.value || '').trim(),
    servico_nome: serv?.nome || '',
    profissional_nome: prof?.nome || '',
    data: agData,
    hora: agHora,
    status: $('agStatus')?.value || 'Pendente',
    valor: Number(serv?.preco || 0)
  });
  if (error) return toast('Erro ao salvar: ' + error.message, 'err');
  if ($('agCliente')) $('agCliente').value = '';
  if ($('agTelefone')) $('agTelefone').value = '';
  if ($('agData')) $('agData').value = '';
  if ($('agHora')) $('agHora').value = '';
  await loadAll();
  showNotif('Agendamento criado!', `${agCli} — ${formatDate(agData)} às ${agHora}.`, 'ok');
}

async function salvarConfig() {
  if (!state?.empresa?.id) return;
  const nome = ($('cfgNome')?.value || '').trim();
  if (!nome) return toast('Digite o nome.', 'err');
  const slugAtual = slugify(state.empresa.slug || '');
  const slugNovo = slugify($('cfgSlug')?.value || slugAtual);
  const updates = {
    nome,
    whatsapp: ($('cfgWhatsapp')?.value || '').trim(),
    endereco: ($('cfgEndereco')?.value || '').trim(),
    cidade: ($('cfgCidade')?.value || '').trim()
  };
  if (slugNovo !== slugAtual) {
    const { data: slugExiste } = await db.from('agenda_empresas')
      .select('id').eq('slug', slugNovo).neq('id', state.empresa.id).maybeSingle();
    if (slugExiste) return toast('Esse link já está em uso.', 'err');
    updates.slug = slugNovo;
  }
  const { data, error } = await db.from('agenda_empresas')
    .update(updates).eq('id', state.empresa.id).select('*').single();
  if (error) return toast('Erro ao salvar: ' + error.message, 'err');
  state.empresa = data || { ...state.empresa, ...updates };
  setText('sideNome', state.empresa.nome);
  setText('sideAvatar', initial(state.empresa.nome));
  const lb = $('sideLinkBox');
  if (lb) lb.textContent = publicUrl(state.empresa.slug);
  renderConfig();
  showNotif('Configurações salvas', '', 'ok');
}

async function salvarRedesSociais() {
  if (!state?.empresa?.id) return;
  const updates = {
    instagram: ($('cfgInstagram')?.value || '').trim(),
    facebook: ($('cfgFacebook')?.value || '').trim(),
    tiktok: ($('cfgTiktok')?.value || '').trim(),
    site: ($('cfgSite')?.value || '').trim()
  };
  const { data, error } = await db.from('agenda_empresas')
    .update(updates).eq('id', state.empresa.id).select('*').single();
  if (error) return toast('Erro ao salvar redes: ' + error.message, 'err');
  state.empresa = data || { ...state.empresa, ...updates };
  showNotif('Redes sociais salvas', '', 'ok');
}

// ── AÇÕES AGENDAMENTO ──
async function confirmarAg(id) {
  const ag = (state.agendamentos || []).find(a => a.id === id);
  if (!ag) return;
  const { error } = await db.from('agenda_agendamentos').update({ status: 'Confirmado' }).eq('id', id);
  if (error) return toast('Erro ao confirmar.', 'err');
  ag.status = 'Confirmado';
  renderAll();
  showNotif('Confirmado!', ag.cliente_nome + ' — ' + formatDate(ag.data) + ' às ' + (ag.hora || '—'), 'ok');
  const tel = (ag.cliente_telefone || '').replace(/\D/g, '');
  if (tel) {
    const msg = `Olá, ${ag.cliente_nome}! Seu agendamento foi confirmado ✅\nServiço: ${ag.servico_nome || '—'}\nData: ${formatDate(ag.data)} às ${ag.hora || '—'}\nAguardamos você!`;
    const link = buildWaLink(tel, msg);
    if (link) window.open(link, '_blank');
  }
}

async function concluirAg(id) {
  const ag = (state.agendamentos || []).find(a => a.id === id);
  if (!ag) return;
  const { error } = await db.from('agenda_agendamentos')
    .update({ status: 'Concluído', financeiro_status: 'Concluído' }).eq('id', id);
  if (error) return toast('Erro ao concluir.', 'err');
  ag.status = 'Concluído'; ag.financeiro_status = 'Concluído';
  renderAll();
  showNotif('Concluído!', ag.cliente_nome + ' — ' + (ag.servico_nome || '—'), 'ok');
}

function abrirWA(id) {
  const ag = (state.agendamentos || []).find(a => a.id === id);
  if (!ag) return;
  const tel = (ag.cliente_telefone || ag.telefone || '').replace(/\D/g, '');
  if (!tel) return toast('Telefone não cadastrado.', 'err');
  const msg = `Olá, ${ag.cliente_nome}! 👋\nServiço: ${ag.servico_nome || '—'}\nData: ${formatDate(ag.data)} às ${ag.hora || '—'}\nAté lá! 😊`;
  const link = buildWaLink(tel, msg);
  if (link) window.open(link, '_blank');
}

// ── MODAL RECUSA ──
function openModalRecusa(id) {
  const ag = (state.agendamentos || []).find(a => a.id === id);
  if (!ag) return;
  if (!podeTerAcoes(ag)) return toast('Este agendamento não permite recusa.', 'warn');
  _recusaId = id; _recusaMotivo = null;
  setText('recusaInfo', `${ag.cliente_nome} · ${formatDate(ag.data)} às ${ag.hora || '—'}`);
  document.querySelectorAll('.motivo-item').forEach(el => {
    el.classList.remove('sel');
    const r = el.querySelector('.motivo-radio');
    if (r) r.innerHTML = '';
  });
  const rmc = $('recusaMotivoCustom');
  if (rmc) rmc.value = '';
  const overlay = $('modalRecusaOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeModalRecusa() {
  const overlay = $('modalRecusaOverlay');
  if (overlay) overlay.classList.remove('open');
  _recusaId = null; _recusaMotivo = null;
}

function selectMotivo(el, motivo) {
  document.querySelectorAll('.motivo-item').forEach(o => {
    o.classList.remove('sel');
    const r = o.querySelector('.motivo-radio');
    if (r) r.innerHTML = '';
  });
  el.classList.add('sel');
  _recusaMotivo = motivo;
}

async function confirmarRecusa() {
  if (!_recusaId) return;
  const motivo = ($('recusaMotivoCustom')?.value || '').trim() || _recusaMotivo;
  if (!motivo) return toast('Escolha um motivo.', 'err');
  const ag = (state.agendamentos || []).find(a => a.id === _recusaId);
  if (!ag) return;
  const { error } = await db.from('agenda_agendamentos')
    .update({ status: 'Recusado', observacoes: motivo }).eq('id', _recusaId);
  if (error) return toast('Erro ao recusar.', 'err');
  ag.status = 'Recusado';
  closeModalRecusa();
  renderAll();
  showNotif('Recusado', ag.cliente_nome + ' — ' + motivo, 'info');
  const tel = (ag.cliente_telefone || '').replace(/\D/g, '');
  if (tel) {
    const pubLink = state.empresa ? publicUrl(state.empresa.slug) : '';
    const msg = `Olá, ${ag.cliente_nome}!\nInfelizmente não conseguimos confirmar seu agendamento para ${formatDate(ag.data)}.\nMotivo: ${motivo}\nEscolha outro horário: ${pubLink}`;
    const link = buildWaLink(tel, msg);
    if (link) window.open(link, '_blank');
  }
}

// ── MODAL REAGENDAR ──
function openModalReagendar(id) {
  const ag = (state.agendamentos || []).find(a => a.id === id);
  if (!ag) return;
  if (!podeTerAcoes(ag)) return toast('Este agendamento não permite reagendamento.', 'warn');
  _reagendarId = id;
  setText('reagendarInfo', `${ag.cliente_nome} · ${formatDate(ag.data)} às ${ag.hora || '—'}`);
  const rd = $('reagendarData'); if (rd) rd.value = ag.data || '';
  const rh = $('reagendarHora'); if (rh) rh.value = ag.hora || '';
  const overlay = $('modalReagendarOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeModalReagendar() {
  const overlay = $('modalReagendarOverlay');
  if (overlay) overlay.classList.remove('open');
  _reagendarId = null;
}

async function confirmarReagendar() {
  if (!_reagendarId) return;
  const data = $('reagendarData')?.value;
  const hora = $('reagendarHora')?.value;
  if (!data || !hora) return toast('Escolha nova data e hora.', 'err');
  const ag = (state.agendamentos || []).find(a => a.id === _reagendarId);
  if (!ag) return;
  const { error } = await db.from('agenda_agendamentos')
    .update({ data, hora, status: 'Reagendado' }).eq('id', _reagendarId);
  if (error) return toast('Erro ao reagendar.', 'err');
  ag.data = data; ag.hora = hora; ag.status = 'Reagendado';
  closeModalReagendar();
  renderAll();
  showNotif('Reagendado!', ag.cliente_nome + ' → ' + formatDate(data) + ' às ' + hora, 'ok');
  const tel = (ag.cliente_telefone || '').replace(/\D/g, '');
  if (tel) {
    const msg = `Olá, ${ag.cliente_nome}!\nSeu agendamento foi reagendado 📅\nNova data: ${formatDate(data)} às ${hora}\nAguardamos você! 😊`;
    const link = buildWaLink(tel, msg);
    if (link) window.open(link, '_blank');
  }
}

// ── CONFIRM MODAL ──
function openConfirmModal({ icon = '⚠️', type = 'danger', title = 'Tem certeza?', body = 'Esta ação não pode ser desfeita.', btnLabel = 'Confirmar', cb }) {
  const wrap = $('confirmIconWrap');
  if (wrap) { wrap.className = 'confirm-icon-wrap ' + type; wrap.textContent = icon; }
  setText('confirmTitle', title);
  setText('confirmBody', body);
  const btn = $('confirmActionBtn');
  if (btn) {
    btn.textContent = btnLabel;
    btn.className = 'btn ' + (type === 'danger' ? 'btn-danger' : 'btn-primary');
  }
  _confirmCb = cb;
  const overlay = $('confirmOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeConfirmModal() {
  const overlay = $('confirmOverlay');
  if (overlay) overlay.classList.remove('open');
  _confirmCb = null;
}

document.addEventListener('DOMContentLoaded', function() {
  const confirmBtn = $('confirmActionBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (_confirmCb) _confirmCb();
      closeConfirmModal();
    });
  }

  const confirmOverlay = $('confirmOverlay');
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', e => {
      if (e.target === confirmOverlay) closeConfirmModal();
    });
  }

  const editOverlay = $('editOverlay');
  if (editOverlay) {
    editOverlay.addEventListener('click', e => {
      if (e.target === editOverlay) closeEditModal();
    });
  }

  const modalRecusaOverlay = $('modalRecusaOverlay');
  if (modalRecusaOverlay) {
    modalRecusaOverlay.addEventListener('click', e => {
      if (e.target === modalRecusaOverlay) closeModalRecusa();
    });
  }

  const modalReagendarOverlay = $('modalReagendarOverlay');
  if (modalReagendarOverlay) {
    modalReagendarOverlay.addEventListener('click', e => {
      if (e.target === modalReagendarOverlay) closeModalReagendar();
    });
  }
});

// ── EDIT MODAL ──
function openEditModal(title, bodyHtml, saveCb) {
  setText('editModalTitle', title);
  const body = $('editModalBody');
  if (body) body.innerHTML = bodyHtml;
  _editSaveCb = saveCb;
  const saveBtn = $('editSaveBtn');
  if (saveBtn) saveBtn.onclick = () => { if (_editSaveCb) _editSaveCb(); };
  const overlay = $('editOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeEditModal() {
  const overlay = $('editOverlay');
  if (overlay) overlay.classList.remove('open');
  _editSaveCb = null;
}

// ── EDITAR ──
function editServico(id) {
  const s = (state.servicos || []).find(x => x.id === id);
  if (!s) return;
  openEditModal('Editar Serviço', `
    <div class="form-gap">
      <div class="field"><label>Nome</label><input id="ed_sn" value="${s.nome || ''}"></div>
      <div class="field-row">
        <div class="field"><label>Preço (R$)</label><input id="ed_sp" type="number" value="${s.preco || 0}"></div>
        <div class="field"><label>Duração (min)</label><input id="ed_sd" type="number" value="${s.duracao_minutos || 60}"></div>
      </div>
    </div>`, async () => {
    const nome = ($('ed_sn')?.value || '').trim();
    if (!nome) return toast('Preencha o nome.', 'err');
    const { error } = await db.from('agenda_servicos').update({
      nome,
      preco: Number($('ed_sp')?.value || 0),
      duracao_minutos: Number($('ed_sd')?.value || 60)
    }).eq('id', id);
    if (error) return toast('Erro ao salvar.', 'err');
    closeEditModal(); await loadAll();
    showNotif('Serviço atualizado', '', 'ok');
  });
}

function editProfissional(id) {
  const p = (state.profissionais || []).find(x => x.id === id);
  if (!p) return;
  openEditModal('Editar Profissional', `
    <div class="form-gap">
      <div class="field"><label>Nome</label><input id="ed_pn" value="${p.nome || ''}"></div>
      <div class="field"><label>Especialidade</label><input id="ed_pe" value="${p.especialidade || ''}"></div>
      <div class="field"><label>Telefone</label><input id="ed_pt" value="${p.telefone || ''}"></div>
    </div>`, async () => {
    const nome = ($('ed_pn')?.value || '').trim();
    if (!nome) return toast('Preencha o nome.', 'err');
    const { error } = await db.from('agenda_profissionais').update({
      nome,
      especialidade: ($('ed_pe')?.value || '').trim(),
      telefone: ($('ed_pt')?.value || '').trim()
    }).eq('id', id);
    if (error) return toast('Erro ao salvar.', 'err');
    closeEditModal(); await loadAll();
    showNotif('Profissional atualizado', '', 'ok');
  });
}

function editCliente(id) {
  const c = (state.clientes || []).find(x => x.id === id);
  if (!c) return;
  openEditModal('Editar Cliente', `
    <div class="form-gap">
      <div class="field"><label>Nome</label><input id="ed_cn" value="${c.nome || ''}"></div>
      <div class="field"><label>Telefone</label><input id="ed_ct" value="${c.telefone || ''}"></div>
      <div class="field"><label>E-mail</label><input id="ed_ce" value="${c.email || ''}"></div>
    </div>`, async () => {
    const nome = ($('ed_cn')?.value || '').trim();
    if (!nome) return toast('Preencha o nome.', 'err');
    const { error } = await db.from('agenda_clientes').update({
      nome,
      telefone: ($('ed_ct')?.value || '').trim(),
      email: ($('ed_ce')?.value || '').trim()
    }).eq('id', id);
    if (error) return toast('Erro ao salvar.', 'err');
    closeEditModal(); await loadAll();
    showNotif('Cliente atualizado', '', 'ok');
  });
}

function editAgendamento(id) {
  const a = (state.agendamentos || []).find(x => x.id === id);
  if (!a) return;
  const svcopts = (state.servicos || []).filter(s => s.status === 'ativo')
    .map(s => `<option value="${s.id}"${s.id === a.servico_id ? ' selected' : ''}>${s.nome}</option>`).join('');
  const profopts = (state.profissionais || []).filter(p => p.status === 'ativo')
    .map(p => `<option value="${p.id}"${p.id === a.profissional_id ? ' selected' : ''}>${p.nome}</option>`).join('');
  openEditModal('Editar Agendamento', `
    <div class="form-gap">
      <div class="field-row">
        <div class="field"><label>Cliente</label><input id="ed_ac" value="${a.cliente_nome || ''}"></div>
        <div class="field"><label>Telefone</label><input id="ed_atel" value="${a.cliente_telefone || ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Serviço</label><select id="ed_as">${svcopts}</select></div>
        <div class="field"><label>Profissional</label><select id="ed_ap">${profopts}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Data</label><input id="ed_ad" type="date" value="${a.data || ''}"></div>
        <div class="field"><label>Hora</label><input id="ed_ah" type="time" value="${a.hora || ''}"></div>
      </div>
      <div class="field"><label>Status</label><select id="ed_ast">
        <option${normStatus(a.status) === 'Confirmado' ? ' selected' : ''}>Confirmado</option>
        <option${normStatus(a.status) === 'Pendente' ? ' selected' : ''}>Pendente</option>
        <option${normStatus(a.status) === 'Reagendado' ? ' selected' : ''}>Reagendado</option>
        <option${normStatus(a.status) === 'Concluído' ? ' selected' : ''}>Concluído</option>
        <option${normStatus(a.status) === 'Recusado' ? ' selected' : ''}>Recusado</option>
        <option${normStatus(a.status) === 'Excluído' ? ' selected' : ''}>Excluído</option>
      </select></div>
    </div>`, async () => {
    const cli = ($('ed_ac')?.value || '').trim();
    const data = $('ed_ad')?.value;
    const hora = $('ed_ah')?.value;
    if (!cli || !data || !hora) return toast('Preencha cliente, data e hora.', 'err');
    const serv = (state.servicos || []).find(s => s.id === $('ed_as')?.value);
    const prof = (state.profissionais || []).find(p => p.id === $('ed_ap')?.value);
    const { error } = await db.from('agenda_agendamentos').update({
      cliente_nome: cli,
      cliente_telefone: ($('ed_atel')?.value || '').trim(),
      servico_id: $('ed_as')?.value || null,
      profissional_id: $('ed_ap')?.value || null,
      servico_nome: serv?.nome || a.servico_nome,
      profissional_nome: prof?.nome || a.profissional_nome,
      data, hora,
      status: $('ed_ast')?.value || 'Pendente',
      valor: Number(serv?.preco || a.valor || 0)
    }).eq('id', id);
    if (error) return toast('Erro ao salvar.', 'err');
    closeEditModal(); await loadAll();
    showNotif('Agendamento atualizado', '', 'ok');
  });
}

// ── DUPLICAR ──
async function duplicarServico(id) {
  const s = (state.servicos || []).find(x => x.id === id);
  if (!s) return;
  await db.from('agenda_servicos').insert({
    empresa_id: state.empresa.id, nome: s.nome + ' (cópia)',
    preco: s.preco, duracao_minutos: s.duracao_minutos, status: 'ativo'
  });
  await loadAll(); showNotif('Serviço duplicado', '', 'info');
}

async function duplicarProfissional(id) {
  const p = (state.profissionais || []).find(x => x.id === id);
  if (!p) return;
  await db.from('agenda_profissionais').insert({
    empresa_id: state.empresa.id, nome: p.nome + ' (cópia)',
    especialidade: p.especialidade, telefone: p.telefone, status: 'ativo'
  });
  await loadAll(); showNotif('Profissional duplicado', '', 'info');
}

async function duplicarCliente(id) {
  const c = (state.clientes || []).find(x => x.id === id);
  if (!c) return;
  await db.from('agenda_clientes').insert({
    empresa_id: state.empresa.id, nome: c.nome + ' (cópia)',
    telefone: c.telefone, email: c.email, status: 'ativo'
  });
  await loadAll(); showNotif('Cliente duplicado', '', 'info');
}

async function duplicarAgendamento(id) {
  const a = (state.agendamentos || []).find(x => x.id === id);
  if (!a) return;
  await db.from('agenda_agendamentos').insert({
    empresa_id: state.empresa.id,
    cliente_id: a.cliente_id, servico_id: a.servico_id,
    profissional_id: a.profissional_id,
    cliente_nome: a.cliente_nome, cliente_telefone: a.cliente_telefone,
    servico_nome: a.servico_nome, profissional_nome: a.profissional_nome,
    data: a.data, hora: a.hora, status: 'Pendente', valor: a.valor
  });
  await loadAll(); showNotif('Agendamento duplicado como Pendente', '', 'info');
}

// ── TOGGLE ──
function toggleServico(id, ns) {
  const s = (state.servicos || []).find(x => x.id === id); if (!s) return;
  openConfirmModal({
    icon: ns === 'ativo' ? '▶️' : '⏸', type: ns === 'ativo' ? 'info' : 'danger',
    title: ns === 'ativo' ? 'Ativar serviço?' : 'Desativar serviço?',
    body: `"${s.nome}"`, btnLabel: ns === 'ativo' ? 'Ativar' : 'Desativar',
    cb: async () => {
      await db.from('agenda_servicos').update({ status: ns }).eq('id', id);
      await loadAll();
      showNotif(ns === 'ativo' ? 'Serviço ativado' : 'Serviço desativado', '', 'ok');
    }
  });
}

function toggleProfissional(id, ns) {
  const p = (state.profissionais || []).find(x => x.id === id); if (!p) return;
  openConfirmModal({
    icon: ns === 'ativo' ? '▶️' : '⏸', type: ns === 'ativo' ? 'info' : 'danger',
    title: ns === 'ativo' ? 'Ativar profissional?' : 'Desativar?',
    body: `"${p.nome}"`, btnLabel: ns === 'ativo' ? 'Ativar' : 'Desativar',
    cb: async () => {
      await db.from('agenda_profissionais').update({ status: ns }).eq('id', id);
      await loadAll();
      showNotif(ns === 'ativo' ? 'Profissional ativado' : 'Profissional desativado', '', 'ok');
    }
  });
}

function toggleCliente(id, ativar) {
  const c = (state.clientes || []).find(x => x.id === id); if (!c) return;
  openConfirmModal({
    icon: ativar ? '▶️' : '⏸', type: ativar ? 'info' : 'danger',
    title: ativar ? 'Ativar cliente?' : 'Desativar?',
    body: `"${c.nome}"`, btnLabel: ativar ? 'Ativar' : 'Desativar',
    cb: async () => {
      await db.from('agenda_clientes').update({ status: ativar ? 'ativo' : 'inativo' }).eq('id', id);
      await loadAll();
      showNotif(ativar ? 'Cliente ativado' : 'Cliente desativado', '', 'ok');
    }
  });
}

// ── EXCLUIR ──
function excluirServico(id) {
  const s = (state.servicos || []).find(x => x.id === id); if (!s) return;
  openConfirmModal({
    icon: '🗑', type: 'danger', title: 'Excluir serviço?', body: `"${s.nome}"`, btnLabel: 'Excluir',
    cb: async () => {
      await db.from('agenda_servicos').update({ status: 'excluido' }).eq('id', id);
      await loadAll(); showNotif('Serviço excluído', '', 'info');
    }
  });
}

function excluirProfissional(id) {
  const p = (state.profissionais || []).find(x => x.id === id); if (!p) return;
  openConfirmModal({
    icon: '🗑', type: 'danger', title: 'Excluir profissional?', body: `"${p.nome}"`, btnLabel: 'Excluir',
    cb: async () => {
      await db.from('agenda_profissionais').update({ status: 'excluido' }).eq('id', id);
      await loadAll(); showNotif('Profissional excluído', '', 'info');
    }
  });
}

function excluirCliente(id) {
  const c = (state.clientes || []).find(x => x.id === id); if (!c) return;
  openConfirmModal({
    icon: '🗑', type: 'danger', title: 'Excluir cliente?', body: `"${c.nome}"`, btnLabel: 'Excluir',
    cb: async () => {
      await db.from('agenda_clientes').update({ status: 'inativo' }).eq('id', id);
      await loadAll(); showNotif('Cliente removido', '', 'info');
    }
  });
}

function excluirAgendamento(id) {
  const a = (state.agendamentos || []).find(x => x.id === id); if (!a) return;
  const jaFoi = normStatus(a.status) === 'Concluído' || a.financeiro_status === 'Concluído';
  openConfirmModal({
    icon: '🗑', type: 'danger',
    title: jaFoi ? 'Arquivar agendamento?' : 'Excluir agendamento?',
    body: `"${a.cliente_nome}" em ${formatDate(a.data)}.${jaFoi ? ' O faturamento será preservado.' : ''}`,
    btnLabel: jaFoi ? 'Arquivar' : 'Excluir',
    cb: async () => {
      const payload = jaFoi
        ? { status: 'Excluído', financeiro_status: 'Concluído' }
        : { status: 'Excluído' };
      const { error } = await db.from('agenda_agendamentos').update(payload).eq('id', id);
      if (error) return toast('Erro ao excluir.', 'err');
      await loadAll();
      showNotif(jaFoi ? 'Agendamento arquivado' : 'Agendamento excluído', jaFoi ? 'Faturamento mantido.' : '', 'info');
    }
  });
}

// ── PUBLIC PAGE ──
function copyPublicLink() {
  if (!state?.empresa?.slug) return;
  const link = publicUrl(state.empresa.slug);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).catch(() => {});
  }
  showNotif('Link copiado!', link, 'ok', 3000);
}

function openPublic() {
  if (!state?.empresa?.slug) return;
  history.pushState(null, '', '#agendar/' + state.empresa.slug);
  loadPublic(state.empresa.slug);
}

async function loadPublic(slug) {
  const lv = $('landingView');
  const dv = $('dashboardView');
  const pv = $('publicView');
  if (lv) lv.style.display = 'none';
  if (dv) dv.style.display = 'none';
  if (pv) pv.style.display = 'block';

  const { data: empresa, error } = await db.from('agenda_empresas')
    .select('*').eq('slug', slug).single();

  if (error || !empresa) {
    setText('pubNomeEmpresa', 'Agenda não encontrada');
    setText('pubDescEmpresa', 'Verifique se o link está correto.');
    return;
  }

  state.pubEmpresa = empresa;
  setText('pubNomeEmpresa', empresa.nome);
  setText('pubDescEmpresa', (empresa.area_atuacao || 'Agendamento Online') + ' • WhatsApp: ' + (empresa.whatsapp || 'Não informado'));

  const sociais = $('pubSociais');
  if (sociais) {
    let html = '';
    if (empresa.instagram) {
      const h = empresa.instagram.replace('@', '').replace(/.*instagram\.com\//, '');
      html += `<a href="https://instagram.com/${h}" target="_blank" rel="noopener" class="pub-social">📸 @${h}</a>`;
    }
    if (empresa.site) {
      const url = empresa.site.startsWith('http') ? empresa.site : 'https://' + empresa.site;
      const lbl = empresa.site.replace(/^https?:\/\//, '').replace(/\/$/, '');
      html += `<a href="${url}" target="_blank" rel="noopener" class="pub-social">🌐 ${lbl}</a>`;
    }
    sociais.innerHTML = html;
    sociais.style.display = html ? 'flex' : 'none';
  }

  const waFab = $('pubWaFab');
  if (waFab) {
    const tel = (empresa.whatsapp || '').replace(/\D/g, '');
    if (tel) {
      const f = tel.startsWith('55') ? tel : '55' + tel;
      waFab.href = 'https://wa.me/' + f + '?text=' + encodeURIComponent('Olá, tenho uma dúvida antes de agendar.');
      waFab.style.display = 'flex';
    } else {
      waFab.style.display = 'none';
    }
  }

  const [svcs, profs] = await Promise.all([
    db.from('agenda_servicos').select('*').eq('empresa_id', empresa.id).eq('status', 'ativo').order('nome'),
    db.from('agenda_profissionais').select('*').eq('empresa_id', empresa.id).eq('status', 'ativo').order('nome')
  ]);
  state.servicos = svcs.data || [];
  state.profissionais = profs.data || [];

  const ps = $('pubServicos');
  if (ps) {
    ps.innerHTML = state.servicos.map(s => `
      <div class="choice" onclick="selectPubSvc('${s.id}',this)">
        <div class="choice-icon">✦</div>
        <div style="flex:1;min-width:0"><div class="choice-title">${s.nome}</div><div class="choice-sub">${s.duracao_minutos || 60} min</div></div>
        <div class="choice-price">${money(s.preco).replace(',00', '')}</div>
      </div>`).join('') ||
      '<div class="empty-state"><div class="es-icon">✦</div><p>Nenhum serviço disponível.</p></div>';
  }

  const pp = $('pubProfissionais');
  if (pp) {
    pp.innerHTML = state.profissionais.map(p => `
      <div class="choice" onclick="selectPubProf('${p.id}',this)">
        <div class="choice-icon">👤</div>
        <div style="flex:1;min-width:0"><div class="choice-title">${p.nome}</div><div class="choice-sub">${p.especialidade || 'Profissional'}</div></div>
      </div>`).join('') ||
      '<div class="empty-state"><div class="es-icon">👤</div><p>Nenhum profissional disponível.</p></div>';
  }
}

function selectPubSvc(id, el) {
  state.pubServico = (state.servicos || []).find(s => s.id === id);
  document.querySelectorAll('#pubServicos .choice').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

function selectPubProf(id, el) {
  state.pubProfissional = (state.profissionais || []).find(p => p.id === id);
  document.querySelectorAll('#pubProfissionais .choice').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

async function confirmarAgendamentoPublico() {
  const pubNome = $('pubClienteNome')?.value?.trim();
  const pubTel = $('pubClienteTel')?.value?.trim();
  const pubData = $('pubData')?.value;
  const pubHora = $('pubHora')?.value;

  if (!state.pubEmpresa || !state.pubServico || !state.pubProfissional || !pubNome || !pubTel || !pubData || !pubHora) {
    return toast('Preencha tudo para confirmar.', 'err');
  }

  try {
    let clienteId = null;
    const { data: cli } = await db.from('agenda_clientes').insert({
      empresa_id: state.pubEmpresa.id,
      nome: pubNome,
      telefone: pubTel,
      status: 'ativo'
    }).select('*').single();
    if (cli) clienteId = cli.id;

    const { error } = await db.from('agenda_agendamentos').insert({
      empresa_id: state.pubEmpresa.id,
      cliente_id: clienteId,
      servico_id: state.pubServico.id,
      profissional_id: state.pubProfissional.id,
      cliente_nome: pubNome,
      cliente_telefone: pubTel,
      servico_nome: state.pubServico.nome,
      profissional_nome: state.pubProfissional.nome,
      data: pubData,
      hora: pubHora,
      status: 'Pendente',
      valor: Number(state.pubServico.preco || 0),
      observacoes: $('pubObs')?.value || ''
    });

    if (error) { console.error(error); return toast('Erro ao confirmar: ' + error.message, 'err'); }

    const mb = $('pubMainBody');
    const cs = $('pubConfirmScreen');
    if (mb) mb.style.display = 'none';
    if (cs) cs.style.display = 'block';
  } catch (e) {
    console.error('Erro ao confirmar agendamento público:', e);
    toast('Erro inesperado. Tente novamente.', 'err');
  }
}

function resetPublic() {
  const mb = $('pubMainBody');
  const cs = $('pubConfirmScreen');
  if (mb) mb.style.display = 'flex';
  if (cs) cs.style.display = 'none';
  const campos = ['pubClienteNome', 'pubClienteTel', 'pubData', 'pubHora', 'pubObs'];
  campos.forEach(id => { const el = $(id); if (el) el.value = ''; });
  state.pubServico = null;
  state.pubProfissional = null;
  document.querySelectorAll('.choice').forEach(c => c.classList.remove('active'));
}

function voltarDaPublica() {
  history.pushState(null, '', location.pathname);
  const pv = $('publicView');
  if (pv) pv.style.display = 'none';
  if (state?.empresa) {
    const dv = $('dashboardView');
    if (dv) dv.style.display = 'block';
    setView('dashboard');
  } else {
    const lv = $('landingView');
    if (lv) lv.style.display = 'block';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── EXPOSE GLOBALS ──
Object.assign(window, {
  openAuth, closeAuth, showLogin, showCadastro,
  goStep1, goStep2, goStep3, autoSlug,
  loginComSenha, finalizarCadastro, logout,
  setView, setFilter,
  salvarCliente, salvarServico, salvarProfissional, salvarAgendamento,
  salvarConfig, salvarRedesSociais,
  confirmarAg, concluirAg, abrirWA,
  openModalRecusa, closeModalRecusa, selectMotivo, confirmarRecusa,
  openModalReagendar, closeModalReagendar, confirmarReagendar,
  editCliente, editServico, editProfissional, editAgendamento,
  duplicarCliente, duplicarServico, duplicarProfissional, duplicarAgendamento,
  toggleCliente, toggleServico, toggleProfissional,
  excluirCliente, excluirServico, excluirProfissional, excluirAgendamento,
  copyPublicLink, openPublic, voltarDaPublica,
  selectPubSvc, selectPubProf, confirmarAgendamentoPublico, resetPublic,
  closeEditModal, closeConfirmModal, closeModalRecusa, closeModalReagendar,
  toast, clearNotifDot, loadPublic,
  openMobileMenu, closeMobileMenu
});


// PATCH_MENU_RESIZE_CLOSE
window.addEventListener('resize', closeAllMenus);
