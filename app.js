// ============================================================
// AGENDAPRO - APP.JS
// Supabase Backend + Full Premium Dashboard Logic
// ============================================================

// ============================================================
// SUPABASE CONFIG
// ============================================================
const SUPABASE_URL = 'https://wyjrjioipqfltdyupfna.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PkDkt5S-_rdrT0HhANoPAw_ZWluV2_H';

const sb = {
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  },

  async get(table, params = '') {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
        headers: { ...this.headers, 'Prefer': 'return=representation' }
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) { console.error('GET error:', e); return []; }
  },

  async post(table, data) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) { console.error('POST error:', e); return null; }
  },

  async patch(table, id, data) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...this.headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) { console.error('PATCH error:', e); return null; }
  },

  async delete(table, id) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: this.headers
      });
      return res.ok;
    } catch (e) { console.error('DELETE error:', e); return false; }
  },

  async auth(email, password) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ email, password })
      });
      return await res.json();
    } catch (e) { console.error('AUTH error:', e); return null; }
  }
};

// ============================================================
// APP STATE
// ============================================================
const STATE = {
  user: null,
  clientes: [],
  servicos: [],
  profissionais: [],
  agendamentos: [],
  financeiro: [],
  mensagens: [],
  calDate: new Date(),
  pubCalDate: new Date(),
  pubSelectedDate: null,
  pubSelectedTime: null,
  pubSelectedServico: null,
  pubSelectedProfissional: null,
  editingId: null
};

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  checkSession();
  renderMobileBtn();
  document.getElementById('dashTodayDate').textContent = formatDateBR(new Date());
  setDefaultFinMes();
});

function setDefaultFinMes() {
  const now = new Date();
  const mesEl = document.getElementById('finMes');
  if (mesEl) mesEl.value = now.getMonth() + 1;
}

function checkSession() {
  const token = localStorage.getItem('agendapro_token');
  const user = localStorage.getItem('agendapro_user');
  if (token && user) {
    STATE.user = JSON.parse(user);
    showApp();
  }
}

function renderMobileBtn() {
  const btn = document.getElementById('mobileMenuBtn');
  if (window.innerWidth <= 768) btn.style.display = 'flex';
  window.addEventListener('resize', () => {
    btn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
  });
}

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtnText');

  if (!email || !pass) { showToast('Preencha todos os campos', 'error'); return; }

  btn.textContent = 'Entrando...';

  const result = await sb.auth(email, pass);

  if (result && result.access_token) {
    localStorage.setItem('agendapro_token', result.access_token);
    localStorage.setItem('agendapro_user', JSON.stringify(result.user));
    STATE.user = result.user;
    showToast('Bem-vindo ao AgendaPro! 🎉', 'success');
    showApp();
  } else {
    showToast('E-mail ou senha inválidos', 'error');
    btn.textContent = 'Entrar no Painel';
  }
}

function doLogout() {
  localStorage.removeItem('agendapro_token');
  localStorage.removeItem('agendapro_user');
  STATE.user = null;
  document.getElementById('appLayout').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  showToast('Sessão encerrada', 'info');
}

function showApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('publicPage').classList.add('hidden');
  document.getElementById('appLayout').classList.remove('hidden');

  const name = STATE.user?.email?.split('@')[0] || 'Admin';
  document.getElementById('sidebarUserName').textContent = name;
  document.getElementById('sidebarAvatarInitial').textContent = name[0].toUpperCase();

  loadAllData();
  navigate('dashboard');
}

function backToLogin() {
  document.getElementById('publicPage').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
}

// ============================================================
// LOAD ALL DATA
// ============================================================
async function loadAllData() {
  await Promise.all([
    loadClientes(),
    loadServicos(),
    loadProfissionais(),
    loadAgenda(),
    loadMensagens()
  ]);
  renderDashboard();
  populateSelects();
}

async function loadClientes() {
  STATE.clientes = await sb.get('clientes', '?order=nome.asc');
  renderClientes();
  document.getElementById('clientesCount').textContent = `${STATE.clientes.length} clientes cadastrados`;
}

async function loadServicos() {
  STATE.servicos = await sb.get('servicos', '?order=nome.asc');
  renderServicos();
  renderPublicServicos();
}

async function loadProfissionais() {
  STATE.profissionais = await sb.get('profissionais', '?order=nome.asc');
  renderProfissionais();
  renderPublicProfissionais();
}

async function loadAgenda() {
  let params = '?order=data.asc,hora.asc';
  const status = document.getElementById('agendaFilterStatus')?.value;
  const data = document.getElementById('agendaFilterData')?.value;
  const prof = document.getElementById('agendaFilterProfissional')?.value;

  const filters = [];
  if (status) filters.push(`status=eq.${status}`);
  if (data) filters.push(`data=eq.${data}`);
  if (prof) filters.push(`profissional_id=eq.${prof}`);
  if (filters.length) params += '&' + filters.join('&');

  STATE.agendamentos = await sb.get('agendamentos', params);
  renderAgendaTable();
  renderDashboardTimeline();
  updateBadges();
}

async function loadMensagens() {
  STATE.mensagens = await sb.get('mensagens', '?order=created_at.desc');
  renderMensagens();
  updateMsgBadge();
}

async function loadFinanceiro() {
  const mes = document.getElementById('finMes')?.value || (new Date().getMonth() + 1);
  const ano = document.getElementById('finAno')?.value || new Date().getFullYear();
  STATE.financeiro = await sb.get('financeiro', `?order=data.desc`);
  const filtered = STATE.financeiro.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() + 1 == mes && d.getFullYear() == ano;
  });
  renderFinanceiro(filtered);
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');

  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Visão geral do sistema'],
    agenda: ['Agenda', 'Gerencie agendamentos'],
    calendario: ['Calendário', 'Visualização mensal'],
    clientes: ['Clientes', 'Gerencie sua base de clientes'],
    servicos: ['Serviços', 'Serviços oferecidos'],
    profissionais: ['Profissionais', 'Sua equipe'],
    financeiro: ['Financeiro', 'Controle financeiro'],
    mensagens: ['Mensagens', 'Comunicação com clientes'],
  };

  const [title, subtitle] = titles[page] || ['AgendaPro', ''];
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarSubtitle').textContent = subtitle;

  closeMobileSidebar();

  if (page === 'agenda') loadAgenda();
  if (page === 'calendario') renderCalendario();
  if (page === 'financeiro') loadFinanceiro();
  if (page === 'clientes') loadClientes();
  if (page === 'servicos') loadServicos();
  if (page === 'profissionais') loadProfissionais();
  if (page === 'mensagens') loadMensagens();
}

// ============================================================
// MOBILE SIDEBAR
// ============================================================
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebarOverlay').classList.add('show');
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const agHoje = STATE.agendamentos.filter(a => a.data === hoje);
  const pendentes = agHoje.filter(a => a.status === 'pendente');

  document.getElementById('statAgendamentos').textContent = agHoje.length;
  document.getElementById('statClientes').textContent = STATE.clientes.length;
  document.getElementById('statPendentes').textContent = pendentes.length;

  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const transacoesMes = STATE.financeiro.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
  });
  const receita = transacoesMes.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0);
  document.getElementById('statReceita').textContent = formatMoney(receita);

  renderDashboardTimeline();
  renderProximosAgendamentos();
  renderActivity();
}

function renderDashboardTimeline() {
  const container = document.getElementById('agendaTimeline');
  const hoje = new Date().toISOString().split('T')[0];
  const agHoje = STATE.agendamentos.filter(a => a.data === hoje);

  if (!agHoje.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📅</div>
      <div class="empty-title">Nenhum agendamento hoje</div>
      <div class="empty-desc">Sua agenda está livre por hoje</div>
    </div>`;
    return;
  }

  container.innerHTML = agHoje.map(ag => {
    const cliente = STATE.clientes.find(c => c.id == ag.cliente_id);
    const servico = STATE.servicos.find(s => s.id == ag.servico_id);
    return `<div class="timeline-item" onclick="openEditAgendamento(${ag.id})">
      <div class="timeline-time">${ag.hora || '--:--'}</div>
      <div class="timeline-dot ${ag.status || 'pendente'}"></div>
      <div class="timeline-info">
        <div class="timeline-client">${cliente?.nome || ag.nome_cliente || 'Cliente'}</div>
        <div class="timeline-service">${servico?.nome || ag.nome_servico || 'Serviço'}</div>
      </div>
      <span class="timeline-status status-${ag.status || 'pendente'}">${capitalize(ag.status || 'pendente')}</span>
    </div>`;
  }).join('');
}

function renderProximosAgendamentos() {
  const container = document.getElementById('proximosAgendamentos');
  const hoje = new Date().toISOString().split('T')[0];
  const proximos = STATE.agendamentos
    .filter(a => a.data > hoje)
    .slice(0, 5);

  if (!proximos.length) {
    container.innerHTML = `<div class="empty-state" style="padding:30px 0;">
      <div class="empty-icon">🗓️</div>
      <div class="empty-title">Sem próximos agendamentos</div>
    </div>`;
    return;
  }

  container.innerHTML = proximos.map(ag => {
    const cliente = STATE.clientes.find(c => c.id == ag.cliente_id);
    return `<div class="timeline-item" style="margin-bottom:8px;" onclick="openEditAgendamento(${ag.id})">
      <div class="timeline-time" style="min-width:70px;">${formatDateShort(ag.data)}</div>
      <div class="timeline-dot ${ag.status || 'pendente'}"></div>
      <div class="timeline-info">
        <div class="timeline-client">${cliente?.nome || ag.nome_cliente || 'Cliente'}</div>
        <div class="timeline-service">${ag.hora || ''}</div>
      </div>
      <span class="timeline-status status-${ag.status || 'pendente'}">${capitalize(ag.status || 'pendente')}</span>
    </div>`;
  }).join('');
}

function renderActivity() {
  const container = document.getElementById('activityList');
  const recent = STATE.agendamentos.slice(0, 6);
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px 0;"><div class="empty-icon">📋</div><div class="empty-title">Nenhuma atividade</div></div>';
    return;
  }
  container.innerHTML = recent.map(ag => {
    const cliente = STATE.clientes.find(c => c.id == ag.cliente_id);
    const icon = ag.status === 'confirmado' ? '✅' : ag.status === 'cancelado' ? '❌' : '📅';
    const cls = ag.status === 'confirmado' ? 'green' : ag.status === 'cancelado' ? 'red' : 'purple';
    return `<div class="activity-item">
      <div class="activity-icon ${cls}">${icon}</div>
      <div>
        <div class="activity-text">Agendamento ${ag.status || 'criado'} — ${cliente?.nome || 'Cliente'}</div>
        <div class="activity-time">${formatDateBR(new Date(ag.data || Date.now()))} ${ag.hora || ''}</div>
      </div>
    </div>`;
  }).join('');
}

function updateBadges() {
  const pendentes = STATE.agendamentos.filter(a => a.status === 'pendente').length;
  document.getElementById('agendaBadge').textContent = pendentes;
}

function updateMsgBadge() {
  const naoLidas = STATE.mensagens.filter(m => !m.lida).length;
  document.getElementById('msgBadge').textContent = naoLidas;
  document.getElementById('msgDot').style.display = naoLidas > 0 ? 'block' : 'none';
}

// ============================================================
// AGENDA TABLE
// ============================================================
function renderAgendaTable() {
  const tbody = document.getElementById('agendaTableBody');
  if (!STATE.agendamentos.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">📅</div>
      <div class="empty-title">Nenhum agendamento encontrado</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.agendamentos.map(ag => {
    const cliente = STATE.clientes.find(c => c.id == ag.cliente_id);
    const servico = STATE.servicos.find(s => s.id == ag.servico_id);
    const prof = STATE.profissionais.find(p => p.id == ag.profissional_id);
    return `<tr>
      <td>
        <div class="avatar-td">
          <div class="mini-avatar">${(cliente?.nome || ag.nome_cliente || 'C')[0].toUpperCase()}</div>
          <span>${cliente?.nome || ag.nome_cliente || '—'}</span>
        </div>
      </td>
      <td>${servico?.nome || ag.nome_servico || '—'}</td>
      <td>${prof?.nome || '—'}</td>
      <td class="font-mono">${formatDateBR(new Date(ag.data))}</td>
      <td class="font-mono">${ag.hora || '—'}</td>
      <td><span class="timeline-status status-${ag.status || 'pendente'}">${capitalize(ag.status || 'pendente')}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="openEditAgendamento(${ag.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAgendamento(${ag.id})">🗑️</button>
          ${cliente?.telefone ? `<button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppCliente('${cliente.telefone}', '${cliente.nome}')">📱</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ============================================================
// CLIENTES
// ============================================================
function renderClientes() {
  const container = document.getElementById('clientesCards');
  if (!STATE.clientes.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👥</div>
      <div class="empty-title">Nenhum cliente cadastrado</div>
      <div class="empty-desc">Clique em "Novo Cliente" para começar</div>
    </div>`;
    return;
  }
  container.innerHTML = STATE.clientes.map(c => {
    const agCount = STATE.agendamentos.filter(a => a.cliente_id == c.id).length;
    return `<div class="client-card">
      <div class="client-avatar">${c.nome[0].toUpperCase()}</div>
      <div class="client-name">${c.nome}</div>
      <div class="client-phone">${c.telefone || 'Sem telefone'}</div>
      <div class="client-footer">
        <div>
          <div class="client-stat-label">Agendamentos</div>
          <div class="client-stat-val">${agCount}</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="openEditCliente(${c.id})">✏️</button>
          ${c.telefone ? `<button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppCliente('${c.telefone}', '${c.nome}')">📱</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteCliente(${c.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterClientes(q) {
  const filtered = q
    ? STATE.clientes.filter(c =>
        c.nome?.toLowerCase().includes(q.toLowerCase()) ||
        c.telefone?.includes(q) ||
        c.email?.toLowerCase().includes(q.toLowerCase())
      )
    : STATE.clientes;
  const container = document.getElementById('clientesCards');
  container.innerHTML = filtered.map(c => {
    const agCount = STATE.agendamentos.filter(a => a.cliente_id == c.id).length;
    return `<div class="client-card">
      <div class="client-avatar">${c.nome[0].toUpperCase()}</div>
      <div class="client-name">${c.nome}</div>
      <div class="client-phone">${c.telefone || 'Sem telefone'}</div>
      <div class="client-footer">
        <div><div class="client-stat-label">Agendamentos</div><div class="client-stat-val">${agCount}</div></div>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="openEditCliente(${c.id})">✏️</button>
          ${c.telefone ? `<button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppCliente('${c.telefone}', '${c.nome}')">📱</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteCliente(${c.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// SERVIÇOS
// ============================================================
function renderServicos() {
  const tbody = document.getElementById('servicosTableBody');
  if (!STATE.servicos.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">
      <div class="empty-icon">⚡</div>
      <div class="empty-title">Nenhum serviço cadastrado</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.servicos.map(s => `<tr>
    <td><strong>${s.nome}</strong>${s.descricao ? `<div class="td-muted">${s.descricao}</div>` : ''}</td>
    <td class="font-mono">${s.duracao || '—'} min</td>
    <td>${s.categoria ? `<span class="badge badge-purple">${s.categoria}</span>` : '—'}</td>
    <td>
      <div class="flex gap-8">
        <button class="btn btn-outline btn-sm" onclick="openEditServico(${s.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteServico(${s.id})">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

// ============================================================
// PROFISSIONAIS
// ============================================================
function renderProfissionais() {
  const container = document.getElementById('profissionaisCards');
  if (!STATE.profissionais.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-title">Nenhum profissional cadastrado</div>
    </div>`;
    return;
  }
  container.innerHTML = STATE.profissionais.map(p => `<div class="pro-card">
    <div class="pro-avatar">${p.nome[0].toUpperCase()}</div>
    <div>
      <div class="pro-name">${p.nome}</div>
      <div class="pro-role">${p.especialidade || 'Profissional'}</div>
    </div>
    <div class="pro-actions">
      ${p.telefone ? `<button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppCliente('${p.telefone}', '${p.nome}')">📱</button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="openEditProfissional(${p.id})">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProfissional(${p.id})">🗑️</button>
    </div>
  </div>`).join('');
}

// ============================================================
// FINANCEIRO
// ============================================================
function renderFinanceiro(data) {
  const receita = data.filter(t => t.tipo === 'receita').reduce((s, t) => s + Number(t.valor), 0);
  const despesa = data.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Number(t.valor), 0);
  const lucro = receita - despesa;

  document.getElementById('finReceita').textContent = formatMoney(receita);
  document.getElementById('finDespesa').textContent = formatMoney(despesa);
  document.getElementById('finLucro').textContent = formatMoney(lucro);

  const tbody = document.getElementById('finTableBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💰</div><div class="empty-title">Sem lançamentos neste período</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(t => `<tr>
    <td class="font-mono">${formatDateBR(new Date(t.data))}</td>
    <td>${t.descricao || '—'}</td>
    <td>${t.tipo === 'receita'
      ? '<span class="badge badge-green">Receita</span>'
      : '<span class="badge badge-red">Despesa</span>'}</td>
    <td style="color: ${t.tipo === 'receita' ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">
      ${t.tipo === 'receita' ? '+' : '-'}${formatMoney(t.valor)}
    </td>
    <td><button class="btn btn-danger btn-sm" onclick="deleteTransacao(${t.id})">🗑️</button></td>
  </tr>`).join('');
}

// ============================================================
// MENSAGENS
// ============================================================
function renderMensagens() {
  const tbody = document.getElementById('mensagensTableBody');
  if (!STATE.mensagens.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">Nenhuma mensagem</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.mensagens.map(m => {
    const cliente = STATE.clientes.find(c => c.id == m.cliente_id);
    return `<tr>
      <td>${cliente?.nome || m.nome_cliente || '—'}</td>
      <td>${m.mensagem || '—'}</td>
      <td>${m.created_at ? formatDateBR(new Date(m.created_at)) : '—'}</td>
      <td>${m.lida ? '<span class="badge badge-green">Lida</span>' : '<span class="badge badge-yellow">Não lida</span>'}</td>
      <td>
        <div class="flex gap-8">
          ${cliente?.telefone ? `<button class="btn btn-whatsapp btn-sm" onclick="openWhatsAppCliente('${cliente.telefone}', '${cliente.nome}')">📱</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteMensagem(${m.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ============================================================
// CALENDARIO
// ============================================================
function renderCalendario() {
  const d = STATE.calDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('calTitle').textContent = `${monthNames[month]} ${year}`;
  buildCalendarGrid('calendarGrid', year, month, handleCalDayClick);
}

function buildCalendarGrid(containerId, year, month, onDayClick) {
  const grid = document.getElementById(containerId);
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    const day = daysInPrev - firstDay + 1 + i;
    html += `<div class="cal-day other-month">${day}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const hasAg = STATE.agendamentos.some(a => a.data === dateStr);
    html += `<div class="cal-day${isToday ? ' today' : ''}${hasAg ? ' has-event' : ''}" onclick="${onDayClick.name}('${dateStr}')">${d}</div>`;
  }

  const remaining = 42 - firstDay - daysInMonth;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-day other-month">${d}</div>`;
  }

  grid.innerHTML = html;
}

function handleCalDayClick(date) {
  document.querySelectorAll('#calendarGrid .cal-day').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');

  const ags = STATE.agendamentos.filter(a => a.data === date);
  const container = document.getElementById('calDayDetail');

  if (!ags.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📅</div>
      <div class="empty-title">Sem agendamentos em ${formatDateBR(new Date(date + 'T12:00:00'))}</div>
    </div>`;
    return;
  }

  container.innerHTML = `<div id="calDayTimeline">` + ags.map(ag => {
    const cliente = STATE.clientes.find(c => c.id == ag.cliente_id);
    const servico = STATE.servicos.find(s => s.id == ag.servico_id);
    return `<div class="timeline-item">
      <div class="timeline-time">${ag.hora || '—'}</div>
      <div class="timeline-dot ${ag.status || 'pendente'}"></div>
      <div class="timeline-info">
        <div class="timeline-client">${cliente?.nome || ag.nome_cliente || 'Cliente'}</div>
        <div class="timeline-service">${servico?.nome || ag.nome_servico || 'Serviço'}</div>
      </div>
      <span class="timeline-status status-${ag.status || 'pendente'}">${capitalize(ag.status || 'pendente')}</span>
    </div>`;
  }).join('') + `</div>`;
}

function calPrev() { STATE.calDate.setMonth(STATE.calDate.getMonth() - 1); renderCalendario(); }
function calNext() { STATE.calDate.setMonth(STATE.calDate.getMonth() + 1); renderCalendario(); }
function calToday() { STATE.calDate = new Date(); renderCalendario(); }

// ============================================================
// PUBLIC PAGE
// ============================================================
function viewPublicPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appLayout').classList.add('hidden');
  document.getElementById('publicPage').classList.remove('hidden');
  renderPublicServicos();
  renderPublicCalendar();
}

function renderPublicServicos() {
  const container = document.getElementById('pubServicos');
  if (!STATE.servicos.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-icon">⚡</div>
      <div class="empty-title">Nenhum serviço disponível</div>
    </div>`;
    return;
  }
  const icons = ['✂️','💅','🧴','💇','🧖','💆','🎨','💈'];
  container.innerHTML = STATE.servicos.map((s, i) => `<div class="pub-service-card" onclick="selectPubServico(${s.id}, this)">
    <div class="pub-service-icon">${icons[i % icons.length]}</div>
    <div class="pub-service-name">${s.nome}</div>
    <div class="pub-service-duration">${s.duracao || 60} minutos</div>
  </div>`).join('');
}

function selectPubServico(id, el) {
  document.querySelectorAll('.pub-service-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  STATE.pubSelectedServico = id;
  document.getElementById('pubStepProfissional').style.display = 'block';
  renderPublicProfissionais();
  document.getElementById('pubStepProfissional').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPublicProfissionais() {
  const container = document.getElementById('pubProfissionais');
  if (!STATE.profissionais.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Sem profissionais disponíveis</div></div>';
    return;
  }
  container.innerHTML = STATE.profissionais.map(p => `<div class="pub-service-card" onclick="selectPubProfissional(${p.id}, this)">
    <div class="pub-service-icon" style="font-size:36px;">${p.nome[0].toUpperCase()}</div>
    <div class="pub-service-name">${p.nome}</div>
    <div class="pub-service-duration">${p.especialidade || 'Profissional'}</div>
  </div>`).join('');
}

function selectPubProfissional(id, el) {
  document.querySelectorAll('#pubProfissionais .pub-service-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  STATE.pubSelectedProfissional = id;
  document.getElementById('pubStepData').style.display = 'block';
  renderPublicCalendar();
  document.getElementById('pubStepData').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPublicCalendar() {
  const d = STATE.pubCalDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('pubCalTitle').textContent = `${monthNames[month]} ${year}`;

  const grid = document.getElementById('pubCalendarGrid');
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month">${daysInPrev - firstDay + 1 + i}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const isPast = new Date(dateStr) < new Date(today.toISOString().split('T')[0]);
    html += `<div class="cal-day${isToday ? ' today' : ''}${isPast ? ' other-month' : ''}" onclick="${isPast ? '' : `selectPubDate('${dateStr}', this)`}">${d}</div>`;
  }

  grid.innerHTML = html;
}

function selectPubDate(date, el) {
  document.querySelectorAll('#pubCalendarGrid .cal-day').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  STATE.pubSelectedDate = date;
  renderPubTimeSlots();
}

function renderPubTimeSlots() {
  const container = document.getElementById('pubTimeSlots');
  const servico = STATE.servicos.find(s => s.id == STATE.pubSelectedServico);
  const duration = servico?.duracao || 60;

  const horariosOcupados = STATE.agendamentos
    .filter(a => a.data === STATE.pubSelectedDate)
    .map(a => a.hora);

  const horarios = [];
  for (let h = 8; h < 19; h++) {
    for (let m = 0; m < 60; m += duration) {
      if (h === 12) continue;
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      horarios.push(time);
    }
  }

  container.innerHTML = horarios.map(t => {
    const busy = horariosOcupados.includes(t);
    return `<div class="pub-time-slot${busy ? ' unavailable' : ''}" onclick="${busy ? '' : `selectPubTime('${t}', this)`}">${t}</div>`;
  }).join('');
}

function selectPubTime(time, el) {
  document.querySelectorAll('.pub-time-slot').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  STATE.pubSelectedTime = time;
  document.getElementById('pubStepCliente').style.display = 'block';
  updatePubSummary();
  document.getElementById('pubStepCliente').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updatePubSummary() {
  const servico = STATE.servicos.find(s => s.id == STATE.pubSelectedServico);
  const prof = STATE.profissionais.find(p => p.id == STATE.pubSelectedProfissional);
  document.getElementById('agendaSummary').innerHTML = `
    <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px;">
      <div style="font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">Resumo do Agendamento</div>
      <div class="flex gap-8" style="margin-bottom:8px;"><span>⚡</span><span>${servico?.nome || '—'}</span></div>
      <div class="flex gap-8" style="margin-bottom:8px;"><span>👤</span><span>${prof?.nome || '—'}</span></div>
      <div class="flex gap-8" style="margin-bottom:8px;"><span>📅</span><span>${STATE.pubSelectedDate ? formatDateBR(new Date(STATE.pubSelectedDate + 'T12:00:00')) : '—'}</span></div>
      <div class="flex gap-8"><span>🕐</span><span>${STATE.pubSelectedTime || '—'}</span></div>
    </div>`;
}

function pubCalPrev() { STATE.pubCalDate.setMonth(STATE.pubCalDate.getMonth() - 1); renderPublicCalendar(); }
function pubCalNext() { STATE.pubCalDate.setMonth(STATE.pubCalDate.getMonth() + 1); renderPublicCalendar(); }

async function confirmarAgendamento() {
  const nome = document.getElementById('agCliente')?.value?.trim() ||
               document.querySelector('#pubStepCliente #agCliente')?.value?.trim();

  // Use IDs corretos da página pública
  const pubNome = document.getElementById('agCliente') ? document.getElementById('agCliente').value.trim() : '';
  const pubTel = document.getElementById('agTelefone') ? document.getElementById('agTelefone').value.trim() : '';

  if (!STATE.pubSelectedServico || !STATE.pubSelectedDate || !STATE.pubSelectedTime || !pubNome || !pubTel) {
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  let clienteId = null;
  const clienteExistente = STATE.clientes.find(c => c.telefone === pubTel);
  if (clienteExistente) {
    clienteId = clienteExistente.id;
  } else {
    const novoCliente = await sb.post('clientes', {
      nome: pubNome,
      telefone: pubTel,
      email: document.getElementById('agEmail')?.value || ''
    });
    if (novoCliente?.[0]) clienteId = novoCliente[0].id;
  }

  const data = {
    cliente_id: clienteId,
    nome_cliente: pubNome,
    servico_id: STATE.pubSelectedServico,
    profissional_id: STATE.pubSelectedProfissional,
    data: STATE.pubSelectedDate,
    hora: STATE.pubSelectedTime,
    status: 'pendente',
    observacoes: document.getElementById('agObs')?.value || ''
  };

  const result = await sb.post('agendamentos', data);
  if (result) {
    showToast('Agendamento realizado com sucesso! ✅', 'success');
    STATE.pubSelectedDate = null;
    STATE.pubSelectedTime = null;
    STATE.pubSelectedServico = null;
    STATE.pubSelectedProfissional = null;
    document.getElementById('pubStepProfissional').style.display = 'none';
    document.getElementById('pubStepData').style.display = 'none';
    document.getElementById('pubStepCliente').style.display = 'none';
    document.querySelectorAll('.pub-service-card').forEach(c => c.classList.remove('selected'));
    ['agCliente','agTelefone','agEmail','agObs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showToast('Erro ao confirmar agendamento. Tente novamente.', 'error');
  }
}

// ============================================================
// MODALS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ============================================================
// MODAL: AGENDAMENTO
// ============================================================
function openModalNovoAgendamento() {
  STATE.editingId = null;
  document.getElementById('agCliente').value = '';
  document.getElementById('agServico').value = '';
  document.getElementById('agProfissional').value = '';
  document.getElementById('agStatus').value = 'pendente';
  document.getElementById('agData').value = new Date().toISOString().split('T')[0];
  document.getElementById('agHora').value = '09:00';
  document.getElementById('agObservacoes').value = '';
  openModal('modalNovoAgendamento');
}

function openEditAgendamento(id) {
  const ag = STATE.agendamentos.find(a => a.id == id);
  if (!ag) return;
  STATE.editingId = id;
  document.getElementById('agCliente').value = ag.cliente_id || '';
  document.getElementById('agServico').value = ag.servico_id || '';
  document.getElementById('agProfissional').value = ag.profissional_id || '';
  document.getElementById('agStatus').value = ag.status || 'pendente';
  document.getElementById('agData').value = ag.data || '';
  document.getElementById('agHora').value = ag.hora || '';
  document.getElementById('agObservacoes').value = ag.observacoes || '';
  openModal('modalNovoAgendamento');
}

async function salvarAgendamento() {
  const data = {
    cliente_id: document.getElementById('agCliente').value || null,
    servico_id: document.getElementById('agServico').value || null,
    profissional_id: document.getElementById('agProfissional').value || null,
    status: document.getElementById('agStatus').value,
    data: document.getElementById('agData').value,
    hora: document.getElementById('agHora').value,
    observacoes: document.getElementById('agObservacoes').value
  };

  if (!data.data) { showToast('Informe a data', 'error'); return; }

  let result;
  if (STATE.editingId) {
    result = await sb.patch('agendamentos', STATE.editingId, data);
  } else {
    result = await sb.post('agendamentos', data);
  }

  if (result) {
    showToast(STATE.editingId ? 'Agendamento atualizado!' : 'Agendamento criado!', 'success');
    closeModal('modalNovoAgendamento');
    await loadAgenda();
    renderDashboard();
  } else {
    showToast('Erro ao salvar agendamento', 'error');
  }
}

async function deleteAgendamento(id) {
  if (!confirm('Excluir este agendamento?')) return;
  const ok = await sb.delete('agendamentos', id);
  if (ok) {
    showToast('Agendamento excluído', 'success');
    await loadAgenda();
    renderDashboard();
  }
}

// ============================================================
// MODAL: CLIENTE
// ============================================================
function openModalNovoCliente() {
  STATE.editingId = null;
  document.getElementById('modalClienteTitle').textContent = 'Novo Cliente';
  document.getElementById('clienteId').value = '';
  document.getElementById('clienteNome').value = '';
  document.getElementById('clienteTelefone').value = '';
  document.getElementById('clienteEmail').value = '';
  document.getElementById('clienteObs').value = '';
  openModal('modalNovoCliente');
}

function openEditCliente(id) {
  const c = STATE.clientes.find(x => x.id == id);
  if (!c) return;
  STATE.editingId = id;
  document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
  document.getElementById('clienteId').value = c.id;
  document.getElementById('clienteNome').value = c.nome || '';
  document.getElementById('clienteTelefone').value = c.telefone || '';
  document.getElementById('clienteEmail').value = c.email || '';
  document.getElementById('clienteObs').value = c.observacoes || '';
  openModal('modalNovoCliente');
}

async function salvarCliente() {
  const nome = document.getElementById('clienteNome').value.trim();
  if (!nome) { showToast('Informe o nome do cliente', 'error'); return; }

  const data = {
    nome,
    telefone: document.getElementById('clienteTelefone').value.trim(),
    email: document.getElementById('clienteEmail').value.trim(),
    observacoes: document.getElementById('clienteObs').value.trim()
  };

  let result;
  if (STATE.editingId) {
    result = await sb.patch('clientes', STATE.editingId, data);
  } else {
    result = await sb.post('clientes', data);
  }

  if (result) {
    showToast(STATE.editingId ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'success');
    closeModal('modalNovoCliente');
    await loadClientes();
    populateSelects();
  } else {
    showToast('Erro ao salvar cliente', 'error');
  }
}

async function deleteCliente(id) {
  if (!confirm('Excluir este cliente?')) return;
  const ok = await sb.delete('clientes', id);
  if (ok) {
    showToast('Cliente excluído', 'success');
    await loadClientes();
    populateSelects();
  }
}

// ============================================================
// MODAL: SERVIÇO
// ============================================================
function openModalNovoServico() {
  STATE.editingId = null;
  document.getElementById('modalServicoTitle').textContent = 'Novo Serviço';
  document.getElementById('servicoId').value = '';
  document.getElementById('servicoNome').value = '';
  document.getElementById('servicoDuracao').value = '60';
  document.getElementById('servicoCategoria').value = '';
  document.getElementById('servicoDesc').value = '';
  openModal('modalNovoServico');
}

function openEditServico(id) {
  const s = STATE.servicos.find(x => x.id == id);
  if (!s) return;
  STATE.editingId = id;
  document.getElementById('modalServicoTitle').textContent = 'Editar Serviço';
  document.getElementById('servicoId').value = s.id;
  document.getElementById('servicoNome').value = s.nome || '';
  document.getElementById('servicoDuracao').value = s.duracao || '';
  document.getElementById('servicoCategoria').value = s.categoria || '';
  document.getElementById('servicoDesc').value = s.descricao || '';
  openModal('modalNovoServico');
}

async function salvarServico() {
  const nome = document.getElementById('servicoNome').value.trim();
  if (!nome) { showToast('Informe o nome do serviço', 'error'); return; }

  const data = {
    nome,
    duracao: parseInt(document.getElementById('servicoDuracao').value) || 60,
    categoria: document.getElementById('servicoCategoria').value.trim(),
    descricao: document.getElementById('servicoDesc').value.trim()
  };

  let result;
  if (STATE.editingId) {
    result = await sb.patch('servicos', STATE.editingId, data);
  } else {
    result = await sb.post('servicos', data);
  }

  if (result) {
    showToast(STATE.editingId ? 'Serviço atualizado!' : 'Serviço criado!', 'success');
    closeModal('modalNovoServico');
    await loadServicos();
    populateSelects();
  } else {
    showToast('Erro ao salvar serviço', 'error');
  }
}

async function deleteServico(id) {
  if (!confirm('Excluir este serviço?')) return;
  const ok = await sb.delete('servicos', id);
  if (ok) {
    showToast('Serviço excluído', 'success');
    await loadServicos();
    populateSelects();
  }
}

// ============================================================
// MODAL: PROFISSIONAL
// ============================================================
function openModalNovoProfissional() {
  STATE.editingId = null;
  document.getElementById('modalProfissionalTitle').textContent = 'Novo Profissional';
  document.getElementById('profissionalId').value = '';
  document.getElementById('profissionalNome').value = '';
  document.getElementById('profissionalEspecialidade').value = '';
  document.getElementById('profissionalTelefone').value = '';
  document.getElementById('profissionalEmail').value = '';
  openModal('modalNovoProfissional');
}

function openEditProfissional(id) {
  const p = STATE.profissionais.find(x => x.id == id);
  if (!p) return;
  STATE.editingId = id;
  document.getElementById('modalProfissionalTitle').textContent = 'Editar Profissional';
  document.getElementById('profissionalId').value = p.id;
  document.getElementById('profissionalNome').value = p.nome || '';
  document.getElementById('profissionalEspecialidade').value = p.especialidade || '';
  document.getElementById('profissionalTelefone').value = p.telefone || '';
  document.getElementById('profissionalEmail').value = p.email || '';
  openModal('modalNovoProfissional');
}

async function salvarProfissional() {
  const nome = document.getElementById('profissionalNome').value.trim();
  if (!nome) { showToast('Informe o nome do profissional', 'error'); return; }

  const data = {
    nome,
    especialidade: document.getElementById('profissionalEspecialidade').value.trim(),
    telefone: document.getElementById('profissionalTelefone').value.trim(),
    email: document.getElementById('profissionalEmail').value.trim()
  };

  let result;
  if (STATE.editingId) {
    result = await sb.patch('profissionais', STATE.editingId, data);
  } else {
    result = await sb.post('profissionais', data);
  }

  if (result) {
    showToast(STATE.editingId ? 'Profissional atualizado!' : 'Profissional cadastrado!', 'success');
    closeModal('modalNovoProfissional');
    await loadProfissionais();
    populateSelects();
  } else {
    showToast('Erro ao salvar profissional', 'error');
  }
}

async function deleteProfissional(id) {
  if (!confirm('Excluir este profissional?')) return;
  const ok = await sb.delete('profissionais', id);
  if (ok) {
    showToast('Profissional excluído', 'success');
    await loadProfissionais();
    populateSelects();
  }
}

// ============================================================
// MODAL: TRANSAÇÃO
// ============================================================
function openModalTransacao() {
  document.getElementById('transDesc').value = '';
  document.getElementById('transTipo').value = 'receita';
  document.getElementById('transValor').value = '';
  document.getElementById('transData').value = new Date().toISOString().split('T')[0];
  openModal('modalTransacao');
}

async function salvarTransacao() {
  const desc = document.getElementById('transDesc').value.trim();
  const valor = parseFloat(document.getElementById('transValor').value);
  const tipo = document.getElementById('transTipo').value;
  const data = document.getElementById('transData').value;

  if (!desc || !valor || !data) { showToast('Preencha todos os campos', 'error'); return; }

  const result = await sb.post('financeiro', { descricao: desc, tipo, valor, data });
  if (result) {
    showToast('Lançamento salvo!', 'success');
    closeModal('modalTransacao');
    await loadFinanceiro();
  } else {
    showToast('Erro ao salvar lançamento', 'error');
  }
}

async function deleteTransacao(id) {
  if (!confirm('Excluir este lançamento?')) return;
  const ok = await sb.delete('financeiro', id);
  if (ok) {
    showToast('Lançamento excluído', 'success');
    await loadFinanceiro();
  }
}

async function deleteMensagem(id) {
  if (!confirm('Excluir esta mensagem?')) return;
  const ok = await sb.delete('mensagens', id);
  if (ok) {
    showToast('Mensagem excluída', 'success');
    await loadMensagens();
  }
}

// ============================================================
// POPULATE SELECTS
// ============================================================
function populateSelects() {
  const clienteSel = document.getElementById('agCliente');
  const servicoSel = document.getElementById('agServico');
  const profSel = document.getElementById('agProfissional');
  const agProfFilter = document.getElementById('agendaFilterProfissional');

  if (clienteSel) {
    const currentVal = clienteSel.value;
    clienteSel.innerHTML = '<option value="">Selecione o cliente...</option>';
    STATE.clientes.forEach(c => {
      clienteSel.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
    clienteSel.value = currentVal;
  }

  if (servicoSel) {
    const currentVal = servicoSel.value;
    servicoSel.innerHTML = '<option value="">Selecione o serviço...</option>';
    STATE.servicos.forEach(s => {
      servicoSel.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
    });
    servicoSel.value = currentVal;
  }

  if (profSel) {
    const currentVal = profSel.value;
    profSel.innerHTML = '<option value="">Selecione o profissional...</option>';
    STATE.profissionais.forEach(p => {
      profSel.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
    profSel.value = currentVal;
  }

  if (agProfFilter) {
    agProfFilter.innerHTML = '<option value="">Todos os profissionais</option>';
    STATE.profissionais.forEach(p => {
      agProfFilter.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
    });
  }
}

// ============================================================
// WHATSAPP
// ============================================================
function openWhatsApp() {
  window.open('https://wa.me/', '_blank');
}

function openWhatsAppCliente(telefone, nome) {
  const num = telefone.replace(/\D/g, '');
  const msg = encodeURIComponent(`Olá, ${nome}! Aqui é o AgendaPro. 😊`);
  window.open(`https://wa.me/55${num}?text=${msg}`, '_blank');
}

// ============================================================
// GLOBAL SEARCH
// ============================================================
function globalSearch(q) {
  if (!q) return;
  const lower = q.toLowerCase();
  const clienteMatch = STATE.clientes.filter(c => c.nome?.toLowerCase().includes(lower));
  if (clienteMatch.length) {
    navigate('clientes');
    filterClientes(q);
  }
}

// ============================================================
// FILTERS
// ============================================================
function clearAgendaFilters() {
  document.getElementById('agendaFilterStatus').value = '';
  document.getElementById('agendaFilterData').value = '';
  document.getElementById('agendaFilterProfissional').value = '';
  loadAgenda();
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================
// UTILS
// ============================================================
function formatDateBR(date) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  return date.toLocaleDateString('pt-BR');
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatMoney(value) {
  return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
