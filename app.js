/* ═══════════════════════════════════════════
   AGENDAPRO — App JS com Supabase
   ═══════════════════════════════════════════ */

// ── SUPABASE CONFIG ──
const SUPABASE_URL = 'https://wyjrjioipqfltdyupfna.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PkDkt5S-_rdrT0HhANoPAw_ZWluV2_H';

async function supaFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

async function supaAuth(action, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${action}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ── PARTICLES ──
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function rand(min, max) { return Math.random() * (max - min) + min; }

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: rand(0, window.innerWidth),
      y: rand(0, window.innerHeight),
      r: rand(0.4, 1.6),
      vx: rand(-0.15, 0.15),
      vy: rand(-0.15, 0.15),
      alpha: rand(0.2, 0.7),
      gold: Math.random() > 0.7
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? `rgba(201,162,39,${p.alpha})`
        : `rgba(200,200,255,${p.alpha * 0.5})`;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── CUSTOM CURSOR ──
(function initCursor() {
  const cursor = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  if (!cursor || !follower) return;

  let mx = 0, my = 0, fx = 0, fy = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
  });

  function animFollower() {
    fx += (mx - fx) * 0.12;
    fy += (my - fy) * 0.12;
    follower.style.left = fx + 'px';
    follower.style.top  = fy + 'px';
    requestAnimationFrame(animFollower);
  }
  animFollower();

  document.querySelectorAll('a,button,.feature-card,.pricing-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(2)';
      follower.style.opacity = '0.3';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%,-50%) scale(1)';
      follower.style.opacity = '1';
    });
  });
})();

// ── NAVBAR SCROLL ──
(function initNav() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  });
})();

// ── HAMBURGER ──
window.closeMobile = function() {
  document.getElementById('mobileMenu').classList.remove('open');
};
document.getElementById('hamburger').addEventListener('click', function() {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── AOS (Animate on scroll) ──
(function initAOS() {
  const els = document.querySelectorAll('[data-aos]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('aos-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => observer.observe(el));
})();

// ── COUNTER ANIMATION ──
function animateCount(el, target, suffix, duration) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    if (suffix === '%') el.textContent = Math.round(start) + suffix;
    else if (target >= 1000) el.textContent = '+' + Math.round(start / 1000) + 'k';
    else el.textContent = '+' + Math.round(start);
    if (start >= target) clearInterval(timer);
  }, 16);
}

(function initCounters() {
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateCount(document.getElementById('statAgend'),   350000, '',  2000);
      animateCount(document.getElementById('statClients'), 12000,  '',  2000);
      animateCount(document.getElementById('statSatisf'),  98,     '%', 1800);
      observer.disconnect();
    }
  }, { threshold: 0.3 });
  const hero = document.querySelector('.hero-stats');
  if (hero) observer.observe(hero);
})();

// ── BAR CHART ANIMATION ──
(function initBarAnim() {
  const bars = document.querySelectorAll('.dp-bar-fill');
  bars.forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(() => { bar.style.width = target; }, 800);
  });
})();

// ── TOAST ──
window.showToast = function(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.className = `toast ${type} show`;
  t.innerHTML = `<i class="fa-solid ${
    type === 'success' ? 'fa-circle-check' :
    type === 'error'   ? 'fa-circle-xmark' : 'fa-circle-info'
  }"></i> ${msg}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); }, 3500);
};

// ── APP ──
window.App = {
  openModal(name) {
    document.getElementById('modalOverlay').classList.add('open');
    const id = `modal${name.charAt(0).toUpperCase() + name.slice(1)}`;
    const modal = document.getElementById(id);
    if (modal) {
      setTimeout(() => modal.classList.add('open'), 10);
    }
  },

  closeModal() {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    setTimeout(() => {
      document.getElementById('modalOverlay').classList.remove('open');
    }, 300);
  },

  switchModal(to) {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    setTimeout(() => { App.openModal(to); }, 150);
  },

  async login() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    const btn   = document.getElementById('btnLoginSubmit');

    errEl.classList.remove('show');
    if (!email || !pass) {
      errEl.textContent = 'Preencha e-mail e senha.';
      errEl.classList.add('show'); return;
    }

    btn.textContent = 'Entrando...'; btn.disabled = true;
    try {
      const data = await supaAuth('token?grant_type=password', { email, password: pass });
      if (data.error || data.error_description) throw new Error(data.error_description || data.error);
      App.closeModal();
      showToast('Login realizado com sucesso! 🎉', 'success');
    } catch(e) {
      errEl.textContent = 'E-mail ou senha incorretos.';
      errEl.classList.add('show');
    } finally {
      btn.textContent = 'Entrar'; btn.disabled = false;
    }
  },

  async cadastro() {
    const nome  = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const senha = document.getElementById('cadSenha').value;
    const errEl = document.getElementById('cadError');
    const btn   = document.getElementById('btnCadSubmit');

    errEl.classList.remove('show');
    if (!nome || !email || !senha) {
      errEl.textContent = 'Preencha todos os campos.';
      errEl.classList.add('show'); return;
    }
    if (senha.length < 6) {
      errEl.textContent = 'Senha deve ter ao menos 6 caracteres.';
      errEl.classList.add('show'); return;
    }

    btn.textContent = 'Criando conta...'; btn.disabled = true;
    try {
      const data = await supaAuth('signup', {
        email, password: senha,
        data: { nome_completo: nome }
      });
      if (data.error || data.error_description) throw new Error(data.error_description || data.error);
      App.closeModal();
      showToast('Conta criada! Verifique seu e-mail. ✉️', 'success');
    } catch(e) {
      errEl.textContent = e.message || 'Erro ao criar conta. Tente novamente.';
      errEl.classList.add('show');
    } finally {
      btn.textContent = 'Criar conta grátis'; btn.disabled = false;
    }
  },

  async salvarAgendamento() {
    const cliente  = document.getElementById('agCliente').value.trim();
    const servico  = document.getElementById('agServico').value;
    const dataHora = document.getElementById('agDataHora').value;
    const obs      = document.getElementById('agObs').value.trim();
    const errEl    = document.getElementById('agError');

    errEl.classList.remove('show');
    if (!cliente || !servico || !dataHora) {
      errEl.textContent = 'Preencha cliente, serviço e data/hora.';
      errEl.classList.add('show'); return;
    }

    try {
      await supaFetch('agendamentos', {
        method: 'POST',
        body: JSON.stringify({
          cliente, servico,
          data_hora: new Date(dataHora).toISOString(),
          observacoes: obs,
          status: 'Pendente',
          created_at: new Date().toISOString()
        })
      });
      App.closeModal();
      showToast('Agendamento salvo no Supabase! ✅', 'success');
    } catch(e) {
      errEl.textContent = 'Erro ao salvar. Verifique as permissões da tabela.';
      errEl.classList.add('show');
    }
  },

  async salvarCliente() {
    const nome  = document.getElementById('cliNome').value.trim();
    const tel   = document.getElementById('cliTel').value.trim();
    const email = document.getElementById('cliEmail').value.trim();
    const errEl = document.getElementById('cliError');

    errEl.classList.remove('show');
    if (!nome) {
      errEl.textContent = 'Nome é obrigatório.';
      errEl.classList.add('show'); return;
    }

    try {
      await supaFetch('clientes', {
        method: 'POST',
        body: JSON.stringify({
          nome, telefone: tel, email,
          created_at: new Date().toISOString()
        })
      });
      App.closeModal();
      showToast('Cliente salvo no Supabase! ✅', 'success');
    } catch(e) {
      errEl.textContent = 'Erro ao salvar. Verifique as permissões da tabela.';
      errEl.classList.add('show');
    }
  },

  async salvarServico() {
    const nome    = document.getElementById('svcNome').value.trim();
    const duracao = document.getElementById('svcDuracao').value;
    const valor   = document.getElementById('svcValor').value;
    const errEl   = document.getElementById('svcError');

    errEl.classList.remove('show');
    if (!nome || !duracao || !valor) {
      errEl.textContent = 'Preencha todos os campos.';
      errEl.classList.add('show'); return;
    }

    try {
      await supaFetch('servicos', {
        method: 'POST',
        body: JSON.stringify({
          nome, duracao_minutos: Number(duracao),
          valor: Number(valor),
          created_at: new Date().toISOString()
        })
      });
      App.closeModal();
      showToast('Serviço salvo no Supabase! ✅', 'success');
    } catch(e) {
      errEl.textContent = 'Erro ao salvar. Verifique as permissões da tabela.';
      errEl.classList.add('show');
    }
  }
};

// ── BOTÕES NAV ──
document.getElementById('btnLogin').addEventListener('click', () => App.openModal('login'));
document.getElementById('btnCadastro').addEventListener('click', () => App.openModal('cadastro'));
document.getElementById('btnHeroCta').addEventListener('click', () => App.openModal('cadastro'));
document.getElementById('btnHeroDemo').addEventListener('click', () => {
  document.getElementById('painel').scrollIntoView({ behavior: 'smooth' });
});

// ── SIDEBAR TABS (visual only) ──
document.querySelectorAll('.fd-nav-item').forEach(item => {
  item.addEventListener('click', function(e) {
    e.preventDefault();
    document.querySelectorAll('.fd-nav-item').forEach(i => i.classList.remove('active'));
    this.classList.add('active');
    const tab = this.dataset.tab;
    document.querySelector('.fd-topbar-title').textContent =
      tab.charAt(0).toUpperCase() + tab.slice(1);
    showToast(`Módulo de ${tab} — disponível na versão completa.`, 'info');
  });
});

// ── LOGOS BAND DUPLICA PARA MARQUEE ──
(function duplicateMarquee() {
  const inner = document.querySelector('.logos-inner');
  if (inner) {
    inner.innerHTML += inner.innerHTML;
  }
})();
