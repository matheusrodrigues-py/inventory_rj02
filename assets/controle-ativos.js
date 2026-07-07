const API_BASE_URL = window.location.origin + '/api';
const TOKEN_KEY = 'controle_ativos_token';
const USER_KEY = 'controle_ativos_usuario';
const PDA_KEY = 'controle_ativos_pda_requisicoes';
const OFFLINE_ASSETS_KEY = 'controle_ativos_assets_offline_v2';
const OFFLINE_USERS_KEY = 'controle_ativos_users_offline';
const REQUEST_SECTORS_KEY = 'controle_ativos_request_sectors';
const REQUEST_LEADERS_KEY = 'controle_ativos_request_leaders';

const state = {
  apiOnline: false,
  view: 'overview',
  user: null,
  assets: [],
  users: [],
  pendingRequests: [],
  pdaRequests: [],
  audit: [],
  selectedAssets: new Set(),
  inventoryStatus: '',
  requestSearch: '',
  assetPage: 1,
  assetPageSize: 8,
  filters: { search: '', category: '', status: '', location: '', cd: '', period: '' },
};

const titles = {
  overview: ['Centro de Controle Operacional', 'Monitoramento estratégico dos ativos e movimentações por setor.'],
  inventory: ['Inventário de Ativos', 'Gerencie, filtre e acompanhe todos os ativos cadastrados.'],
  requests: ['Requisições', 'Solicite PDAs de forma rápida e acompanhe o andamento.'],
  users: ['Usuários', 'Gerencie acessos, perfis e líderes da operação.'],
  reports: ['Relatórios', 'Indicadores e exportações do controle de ativos.'],
  settings: ['Configurações', 'Preferências do sistema, API e unidade operacional.'],
};

const mockAssets = [
  { id: 901, codigo_patrimonio: 'PDA-RJ02-001', tipo: 'PDA', modelo: 'Zebra TC21', numero_serie: 'SN-TC21-001', status: 'Disponivel', usuario_atual_nome: '', filial: 'RJ02', observacoes: 'Inbound', atualizado_em: new Date().toISOString() },
  { id: 902, codigo_patrimonio: 'PDA-RJ02-002', tipo: 'PDA', modelo: 'Zebra TC26', numero_serie: 'SN-TC26-014', status: 'Em Uso', usuario_atual_nome: 'Ana Silva', filial: 'RJ02', observacoes: 'Outbound', atualizado_em: new Date().toISOString() },
  { id: 903, codigo_patrimonio: 'IMP-RJ02-003', tipo: 'Impressora', modelo: 'Zebra ZD220', numero_serie: 'ZD-7781', status: 'Manutencao', usuario_atual_nome: '', filial: 'RJ02', observacoes: 'Nurse', atualizado_em: new Date().toISOString() },
  { id: 904, codigo_patrimonio: 'PAL-RJ02-004', tipo: 'Paleteira', modelo: 'Manual 2T', numero_serie: 'PL-404', status: 'Baixado', usuario_atual_nome: '', filial: 'RJ02', observacoes: 'Sortation', atualizado_em: new Date().toISOString() },
  { id: 905, codigo_patrimonio: 'PDA-RJ02-005', tipo: 'PDA', modelo: 'Honeywell EDA52', numero_serie: 'EDA-891', status: 'Disponivel', usuario_atual_nome: '', filial: 'RJ02', observacoes: 'Tratativas', atualizado_em: new Date().toISOString() },
];

const mockUsers = [
  { id: 1, nome: 'Ana Silva', email: 'ana@shopeexpress.com', cargo: 'Administrador', filial: 'RJ02', perfil: 'admin', ativo: 1, ultimo_acesso: 'Hoje' },
  { id: 2, nome: 'Bruno Lima', email: 'bruno@shopeexpress.com', cargo: 'Líder T2', filial: 'Outbound', perfil: 'gestor', ativo: 1, ultimo_acesso: 'Ontem' },
  { id: 3, nome: 'Carla Souza', email: 'carla@shopeexpress.com', cargo: 'Operadora', filial: 'Inbound', perfil: 'colaborador', ativo: 1, ultimo_acesso: '2 dias' },
];

function token() { return localStorage.getItem(TOKEN_KEY); }
function authHeaders(json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token()) headers.Authorization = `Bearer ${token()}`;
  return headers;
}
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...authHeaders(options.body !== undefined), ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.sucesso === false) {
    const validation = Array.isArray(payload.erros) ? payload.erros.map((e) => e.msg).join(' ') : '';
    const error = new Error(payload.mensagem || validation || 'Erro na API.');
    error.status = response.status;
    throw error;
  }
  return payload;
}
function $(id) { return document.getElementById(id); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function formatDate(value) { if (!value) return '-'; const d = new Date(String(value).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR'); }
function getStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function setStored(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function toast(message, type = 'success') { const el = $('toast'); el.textContent = message; el.className = `toast show ${type}`; setTimeout(() => { el.className = 'toast'; }, 3300); }
function setApiStatus(online) { state.apiOnline = online; $('api-status').textContent = online ? 'API online' : 'API offline'; $('api-status').className = `api-pill ${online ? 'online' : 'offline'}`; $('settings-api-status').value = online ? 'API online' : 'API offline - usando dados locais'; }
function isManager() { return state.user && ['admin', 'gestor'].includes(state.user.perfil); }
function isAdmin() { return state.user && state.user.perfil === 'admin'; }
function statusBadge(status) {
  const map = { Disponivel: ['available', 'Disponível'], 'Em Uso': ['in-use', 'Em uso'], Manutencao: ['maintenance', 'Manutenção'], Baixado: ['retired', 'Baixado'], 'Em análise': ['pending', 'Em análise'], Aprovada: ['approved', 'Aprovada'], Rejeitada: ['rejected', 'Rejeitada'], Entregue: ['available', 'Entregue'], Devolvido: ['available', 'Devolvido'], Pendente: ['pending', 'Pendente'] };
  const [cls, label] = map[status] || ['pending', status || 'Pendente'];
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

async function login(event) {
  event.preventDefault();
  const email = $('login-email').value.trim();
  const senha = $('login-senha').value;
  try {
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    state.user = result.usuario;
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.usuario));
    setApiStatus(true);
    await startApp();
    toast('Login realizado com sucesso.');
  } catch (error) {
    if (error.status) { toast(error.message, 'error'); return; }
    state.user = { id: 0, nome: 'Admin Demo', email: email || 'demo@local', perfil: 'admin', cargo: 'Administrador', filial: 'RJ02' };
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    setApiStatus(false);
    await startApp();
    toast('API offline: painel aberto em modo demonstração.', 'warn');
  }
}
async function logout() {
  try { if (token()) await api('/auth/logout', { method: 'POST' }); } catch {}
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  $('app-shell').hidden = true;
  $('login-screen').hidden = false;
  document.body.classList.remove('app-ready');
}
async function restoreSession() {
  const saved = getStored(USER_KEY, null);
  if (!saved) { $('login-screen').hidden = false; return; }
  state.user = saved;
  if (token()) {
    try {
      const me = await api('/auth/me');
      state.user = me.usuario;
      localStorage.setItem(USER_KEY, JSON.stringify(me.usuario));
      setApiStatus(true);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        state.user = null;
        $('app-shell').hidden = true;
        $('login-screen').hidden = false;
        setTimeout(() => toast('Sessão expirada. Faça login novamente.', 'warn'), 200);
        return;
      }
      setApiStatus(false);
    }
  } else {
    setApiStatus(false);
  }
  await startApp();
}
async function startApp() {
  $('login-screen').hidden = true;
  $('app-shell').hidden = false;
  document.body.classList.add('app-ready');
  configureProfileOptions();
  renderUserIdentity();
  applyPermissions();
  await loadData();
  navigate(state.view);
}

async function loadData() {
  state.pdaRequests = getStored(PDA_KEY, []);
  try {
    const [assets, users, pending, audit] = await Promise.allSettled([api('/ativos'), api('/usuarios'), api('/requisicoes/pendentes'), isManager() ? api('/auditoria') : Promise.resolve({ dados: [] })]);
    if (assets.status === 'fulfilled') { state.assets = assets.value.dados || []; setStored(OFFLINE_ASSETS_KEY, state.assets); setApiStatus(true); } else { throw assets.reason; }
    state.users = users.status === 'fulfilled' ? users.value.dados || [] : getStored(OFFLINE_USERS_KEY, mockUsers);
    state.pendingRequests = pending.status === 'fulfilled' ? pending.value.dados || [] : [];
    state.audit = audit.status === 'fulfilled' ? audit.value.dados || [] : [];
    setStored(OFFLINE_USERS_KEY, state.users);
  } catch (error) {
    setApiStatus(false);
    state.assets = getStored(OFFLINE_ASSETS_KEY, []);
    state.users = getStored(OFFLINE_USERS_KEY, mockUsers);
    state.pendingRequests = [];
    state.audit = buildOfflineAudit();
  }
  updateBadges();
}
function buildOfflineAudit() { return [{ acao: 'MODO_OFFLINE', entidade: 'sistema', criado_em: new Date().toISOString(), usuario_nome: state.user?.nome || 'Sistema', detalhes: 'Dados de exemplo carregados.' }]; }
function renderUserIdentity() {
  const name = state.user?.nome || 'Admin';
  $('sidebar-user-name').textContent = name;
  $('sidebar-user-role').textContent = roleLabel(state.user?.perfil || 'admin');
  $('sidebar-avatar').textContent = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  $('notification-badge').textContent = String(state.pdaRequests.filter((r) => r.status === 'Em análise').length);
}
function roleLabel(role) { return { admin: 'Administrador', gestor: 'Líder / Gestor', colaborador: 'Colaborador' }[role] || 'Usuário'; }
function applyPermissions() {
  const canManage = isManager();
  $('new-asset-btn').hidden = !canManage;
  $('new-user-btn').hidden = !canManage;
}
function managerAssetActions(a) {
  if (!isManager()) return '';
  const deleteButton = isAdmin() ? `<button class="btn danger" data-asset-delete="${a.id}">Excluir</button>` : '';
  return `<button class="btn secondary" data-asset-edit="${a.id}">Editar</button><button class="btn secondary" data-asset-more="${a.id}">Mais opções</button>${deleteButton}`;
}
function configureProfileOptions() {
  const select = $('user-profile');
  const options = [['colaborador', 'Colaborador'], ['gestor', 'Gestor']];
  if (isAdmin()) options.push(['admin', 'Admin']);
  select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}
function updateBadges() {
  const pending = state.pendingRequests.length + state.pdaRequests.filter((r) => r.status === 'Em análise').length;
  $('badge-pendentes').textContent = String(pending);
  $('notification-badge').textContent = String(pending);
}

function navigate(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.side-nav button').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  const [title, subtitle] = titles[view];
  $('page-title').textContent = title;
  $('page-subtitle').textContent = subtitle;
  const renderers = { overview: renderOverview, inventory: renderInventory, requests: renderRequests, users: renderUsers, reports: renderReports, settings: renderSettings };
  renderers[view]?.();
  $('sidebar').classList.remove('open');
}

function counts() {
  const total = state.assets.length;
  const available = state.assets.filter((a) => a.status === 'Disponivel').length;
  const inUse = state.assets.filter((a) => a.status === 'Em Uso').length;
  const maintenance = state.assets.filter((a) => a.status === 'Manutencao').length;
  const retired = state.assets.filter((a) => a.status === 'Baixado').length;
  const pending = state.pendingRequests.length + state.pdaRequests.filter((r) => r.status === 'Em análise').length;
  const pdaAssets = state.assets.filter(isPdaAsset);
  const pdaAvailable = pdaAssets.filter((a) => a.status === 'Disponivel').length;
  const pdaInUse = pdaAssets.filter((a) => a.status === 'Em Uso').length;
  const pdaPendingReturn = pdaCriticalAssets().length;
  return { total, available, inUse, maintenance, retired, pending, critical: maintenance + retired + pdaPendingReturn, pdaPendingReturn, pdaAvailable, pdaInUse };
}
function metric(icon, label, value, variation = '+0%') { return `<article class="metric-card"><div class="metric-top"><span>${label}</span><div class="metric-icon">${icon}</div></div><b>${value}</b><small>${variation} vs. último ciclo</small></article>`; }
function renderOverview() {
  const c = counts();
  $('overview-metrics').innerHTML = [metric('?', 'Ativos cadastrados', c.total, '+8%'), metric('P', 'PDAs disponíveis', c.pdaAvailable, '+4%'), metric('?', 'PDAs em uso', c.pdaInUse, '+12%'), metric('?', 'Em manutenção', c.maintenance, '-2%'), metric('?', 'Requisições pendentes', c.pending, '+6%'), metric('!', 'Ativos críticos', c.critical, 'Pendências + manutenção')].join('');
  $('overview-assets').innerHTML = state.assets.slice(0, 6).map((a) => `<tr><td>${escapeHtml(a.codigo_patrimonio)}</td><td>${assetName(a)}</td><td>${statusBadge(a.status)}</td><td>${escapeHtml(a.usuario_atual_nome || '-')}</td><td>${formatDate(a.atualizado_em)}</td></tr>`).join('') || emptyRow(5, 'Nenhum ativo encontrado.');
  renderPdaAreaDashboard();
  renderCriticalPdaList();
  renderStatusChart('status-chart', state.assets);

}
function assetName(a) { return `${escapeHtml(a.modelo || a.tipo || 'Ativo')} <span class="muted">${escapeHtml(a.tipo || '')}</span>`; }
function isPdaAsset(asset) {
  const text = `${asset.codigo_patrimonio || ''} ${asset.tipo || ''} ${asset.modelo || ''}`.toLowerCase();
  return asset.tipo === 'PDA' || text.includes('pda') || text.includes('zebra') || text.includes('honeywell') || text.includes('newland') || text.includes('nls-mt90') || text.includes('tc210k');
}
function assetArea(asset) {
  return asset.observacoes || asset.filial || 'Sem área definida';
}
function pdaAreaStats() {
  const map = new Map();
  state.assets.filter(isPdaAsset).forEach((asset) => {
    const area = assetArea(asset);
    const current = map.get(area) || { area, total: 0, available: 0, inUse: 0, maintenance: 0 };
    current.total += 1;
    if (asset.status === 'Disponivel') current.available += 1;
    if (asset.status === 'Em Uso') current.inUse += 1;
    if (asset.status === 'Manutencao') current.maintenance += 1;
    map.set(area, current);
  });
  return [...map.values()].sort((a, b) => b.total - a.total || a.area.localeCompare(b.area));
}
function pdaCriticalAssets() {
  return state.assets
    .filter((asset) => isPdaAsset(asset) && asset.status === 'Em Uso' && asset.usuario_atual_nome)
    .sort((a, b) => String(a.usuario_atual_nome).localeCompare(String(b.usuario_atual_nome)));
}
function renderPdaAreaDashboard() {
  const rows = pdaAreaStats();
  if (!rows.length) {
    $('pda-area-dashboard').innerHTML = emptyMini('Nenhum PDA cadastrado por área/setor.');
    return;
  }
  const max = Math.max(1, ...rows.map((row) => row.total));
  $('pda-area-dashboard').innerHTML = rows.map((row) => {
    const usedPct = Math.round(row.inUse / max * 100);
    const availablePct = Math.round(row.available / max * 100);
    return `<div class="area-row"><div><strong>${escapeHtml(row.area)}</strong><span>${row.total} PDA(s) cadastrados</span></div><div class="area-bars"><div class="area-track"><span class="area-fill available" style="width:${availablePct}%"></span><span class="area-fill in-use" style="width:${usedPct}%"></span></div><small><b>${row.available}</b> disponíveis · <b>${row.inUse}</b> em uso · <b>${row.maintenance}</b> manutenção</small></div></div>`;
  }).join('');
}
function renderCriticalPdaList() {
  const rows = pdaCriticalAssets();
  if (!rows.length) {
    $('critical-pda-list').innerHTML = emptyMini('Nenhuma pendência de devolução no momento.');
    return;
  }
  $('critical-pda-list').innerHTML = rows.map((asset) => `<div class="critical-item"><div class="critical-avatar">${escapeHtml(String(asset.usuario_atual_nome).slice(0, 2).toUpperCase())}</div><div><strong>${escapeHtml(asset.usuario_atual_nome)}</strong><span>${escapeHtml(asset.codigo_patrimonio)} · ${escapeHtml(assetArea(asset))}</span><small>Retirado / em uso desde ${formatDate(asset.atualizado_em)}</small></div><span class="badge pending">Aguardando devolução</span></div>`).join('');
}
function renderStatusChart(id, assets) {
  const c = counts();
  const rows = [['Disponível', c.available, 'var(--green)'], ['Em uso', c.inUse, 'var(--blue)'], ['Manutenção', c.maintenance, 'var(--purple)'], ['Baixado', c.retired, 'var(--red)']];
  const max = Math.max(1, c.total);
  $(id).innerHTML = rows.map(([label, value, color]) => `<div class="chart-row"><span>${label}</span><div class="chart-track"><div class="chart-fill" style="width:${Math.round(value / max * 100)}%;background:${color}"></div></div><b>${value}</b></div>`).join('');
}

function renderInventory() {
  const c = counts();
  $('inventory-metrics').innerHTML = [metric('?', 'Total de ativos', c.total), metric('?', 'Disponíveis', c.available), metric('?', 'Em uso', c.inUse), metric('?', 'Em manutenção', c.maintenance), metric('×', 'Inativos/Baixados', c.retired)].join('');
  renderAssetsTable();
}
function filteredAssets() {
  let data = [...state.assets];
  const f = state.filters;
  const status = f.status || state.inventoryStatus;
  if (status) data = data.filter((a) => a.status === status);
  if (f.category) data = data.filter((a) => a.tipo === f.category);
  if (f.search) { const q = f.search.toLowerCase(); data = data.filter((a) => [a.codigo_patrimonio, a.modelo, a.numero_serie, a.usuario_atual_nome].some((v) => String(v || '').toLowerCase().includes(q))); }
  if (f.location) data = data.filter((a) => String(a.observacoes || '').toLowerCase().includes(f.location.toLowerCase()));
  if (f.cd) data = data.filter((a) => String(a.filial || '').toLowerCase().includes(f.cd.toLowerCase()));
  return data;
}
function renderAssetsTable() {
  const data = filteredAssets();
  const totalPages = Math.max(1, Math.ceil(data.length / state.assetPageSize));
  if (state.assetPage > totalPages) state.assetPage = totalPages;
  const start = (state.assetPage - 1) * state.assetPageSize;
  const rows = data.slice(start, start + state.assetPageSize);
  $('assets-table').innerHTML = rows.map((a) => assetRow(a)).join('') || emptyRow(11, 'Nenhum ativo encontrado para os filtros selecionados.');
  $('asset-results-count').textContent = `${data.length} resultado(s)`;
  $('asset-page-label').textContent = `${state.assetPage}/${totalPages}`;
  $('prev-assets').disabled = state.assetPage <= 1;
  $('next-assets').disabled = state.assetPage >= totalPages;
  updateBulkBar();
}
function assetRow(a) {
  const checked = state.selectedAssets.has(String(a.id)) ? 'checked' : '';
  return `<tr><td><input type="checkbox" class="asset-check" value="${a.id}" ${checked}></td><td><strong>${escapeHtml(a.codigo_patrimonio)}</strong><br><span class="muted">ID ${a.id}</span></td><td><div class="asset-cell"><div class="asset-icon">${assetIcon(a.tipo)}</div><div><strong>${escapeHtml(a.modelo || a.tipo)}</strong><span>${escapeHtml(a.observacoes || 'Sem localização')}</span></div></div></td><td>${escapeHtml(a.tipo)}</td><td>${escapeHtml(a.numero_serie || '-')}</td><td>${statusBadge(a.status)}</td><td>${escapeHtml(a.usuario_atual_nome || '-')}</td><td>${escapeHtml(a.observacoes || '-')}</td><td>${escapeHtml(a.filial || 'RJ02')}</td><td>${formatDate(a.atualizado_em)}</td><td><div class="row-actions"><button class="btn secondary" data-asset-view="${a.id}">Visualizar</button>${managerAssetActions(a)}</div></td></tr>`;
}
function assetIcon(type) { return ({ PDA: 'P', Notebook: 'N', Radio: 'R', Coletor: 'C', Impressora: 'I', Paleteira: 'M', Outro: 'A' })[type] || 'A'; }
function updateBulkBar() { $('bulk-bar').hidden = state.selectedAssets.size === 0; $('selected-count').textContent = String(state.selectedAssets.size); }

function renderRequests() {
  renderRequestOptionSelects();
  renderRequestSummary();
  renderPdaLists();
}
function normalizeSerial(value) { return String(value || '').trim().toLowerCase(); }
function findAssetBySerial(serial) {
  const value = normalizeSerial(serial);
  if (!value) return null;
  return state.assets.find((asset) => [asset.numero_serie, asset.codigo_patrimonio].some((field) => normalizeSerial(field) === value));
}
function defaultRequestSectors() {
  return ['ADM', 'Recepção', 'Security', 'Reversa', 'Inbound', 'Matriz', 'Zona A', 'Zona B', 'Zona C', 'InterSoC', 'Esteira A', 'Esteira B', 'Esteira C', 'Almoxarifado', 'Meio Ambiente', 'Hub', 'QB', 'Ambulatório', 'Manutenção', 'COP'];
}
function requestOptionKey(kind) { return kind === 'leader' ? REQUEST_LEADERS_KEY : REQUEST_SECTORS_KEY; }
function requestOptionSelect(kind) { return kind === 'leader' ? $('req-leader') : $('req-sector'); }
function getRequestOptions(kind) {
  const fallback = kind === 'leader' ? defaultRequestLeaders() : defaultRequestSectors();
  return getStored(requestOptionKey(kind), fallback);
}
function defaultRequestLeaders() {
  return [
    'Adryene Freire',
    'Alexandre Ferreira',
    'Alexandre Nascimento',
    'Alex Cardoso',
    'Anderson M. Soares',
    'Anderson Pinheiro',
    'Andre Marins',
    'Andrey Dias',
    'Camila Colares',
    'Carla Nascimento',
    'Carlos David',
    'Cristiano Mendes',
    'Débora Raquel',
    'Diana Constantino',
    'Diego Cassador',
    'Diogo Rodrigues',
    'Douglas Csousa',
    'Douglas Moraessantos',
    'Edson Sousa',
    'Eliezer Marinho',
    'Elisabete Silveira',
    'Elisangela Benevides',
    'Erivania Vieira',
    'Evandro Costa',
    'Eveline Lima',
    'Fabiano Lsilva',
    'Fabio Ferreira',
    'Francisco Oscar',
    'Gabriela Duarte',
    'Gilson Conceicao',
    'Glaciele Barbosa',
    'Glauciane Lopes',
    'Heloisa Lopes',
    'Joao Alvarenga',
    'Joao Caraujo',
    'Jonathan Fernandes',
    'Jonathas Silva',
    'Kellvin Pinto',
    'Leticia Cnascimento',
    'Lucas Carvalho',
    'Marcelle Lemos',
    'Marcia Farias',
    'Marcio Silva Costa',
    'Marcos figueiredo',
    'Marcos Sousa',
    'Michel Rdsilva',
    'Patrick Caldeira',
    'Rafael Pdsilva',
    'Ramon Juvenal',
    'Renata Silva',
    'Rivadavia Silva',
    'Ronaldo Oliveira',
    'Rubens Lima',
    'Sthefany Correa',
    'Tharciso Mendes',
    'Thiago Carvalho Oliveira',
    'Valdemir Junior',
    'Victor Fonseca',
    'Vitor Brunes',
    'William Purcell',
  ];
}
function saveRequestOptions(kind, options) { setStored(requestOptionKey(kind), [...new Set(options.filter(Boolean))].sort((a, b) => a.localeCompare(b))); }
function renderRequestOptionSelects() {
  ['sector', 'leader'].forEach((kind) => {
    const select = requestOptionSelect(kind);
    const selected = select.value;
    const label = kind === 'leader' ? 'Selecione o líder' : 'Selecione o setor';
    const options = getRequestOptions(kind);
    select.innerHTML = `<option value="">${label}</option>${options.map((item) => `<option>${escapeHtml(item)}</option>`).join('')}`;
    if (selected && options.includes(selected)) select.value = selected;
  });
}
function manageRequestOption(kind, action) {
  const select = requestOptionSelect(kind);
  const label = kind === 'leader' ? 'líder' : 'setor';
  const options = getRequestOptions(kind);
  const current = select.value;
  if (action === 'add') {
    const value = prompt(`Novo ${label}:`, '');
    if (!value?.trim()) return;
    saveRequestOptions(kind, [...options, value.trim()]);
    renderRequestOptionSelects();
    select.value = value.trim();
  }
  if (action === 'edit') {
    if (!current) { toast(`Selecione um ${label} para editar.`, 'warn'); return; }
    const value = prompt(`Editar ${label}:`, current);
    if (!value?.trim()) return;
    saveRequestOptions(kind, options.map((item) => item === current ? value.trim() : item));
    renderRequestOptionSelects();
    select.value = value.trim();
  }
  if (action === 'delete') {
    if (!current) { toast(`Selecione um ${label} para excluir.`, 'warn'); return; }
    if (!confirm(`Excluir ${current}?`)) return;
    saveRequestOptions(kind, options.filter((item) => item !== current));
    renderRequestOptionSelects();
  }
  renderRequestSummary();
}
function requestFormData() {
  const asset = findAssetBySerial($('req-serial').value);
  return { serial: $('req-serial').value.trim(), asset, nome_colaborador: $('req-employee').value.trim(), setor: $('req-sector').value.trim(), lider: $('req-leader').value.trim(), turno: $('req-shift').value };
}
function renderRequestSummary() {
  const d = requestFormData();
  const now = new Date();
  $('req-date-now').value = now.toLocaleString('pt-BR');
  const hint = $('req-asset-hint');
  const card = $('req-asset-card');
  if (!d.serial) {
    hint.textContent = 'Aguardando leitura do ativo.';
    hint.className = '';
    card.hidden = true;
  } else if (!d.asset) {
    hint.textContent = 'Serial não encontrado no inventário.';
    hint.className = 'field-error';
    card.hidden = true;
  } else {
    const available = d.asset.status === 'Disponivel';
    hint.textContent = available ? 'Ativo encontrado e disponível para entrega.' : `Ativo encontrado, mas está com status ${d.asset.status}.`;
    hint.className = available ? 'field-ok' : 'field-error';
    card.hidden = false;
    card.innerHTML = `<div><strong>${escapeHtml(d.asset.codigo_patrimonio)}</strong><span>${escapeHtml(d.asset.modelo || d.asset.tipo)} · ${escapeHtml(d.asset.tipo)}</span></div>${statusBadge(d.asset.status)}`;
  }
  const rows = [['Ativo', d.asset ? `${d.asset.codigo_patrimonio} · ${d.asset.tipo}` : '-'], ['Serial', d.serial || '-'], ['Colaborador', d.nome_colaborador || '-'], ['Setor', d.setor || '-'], ['Líder', d.lider || '-'], ['Turno', d.turno || '-'], ['Data/hora', now.toLocaleString('pt-BR')]];
  $('request-summary').innerHTML = rows.map(([label, value]) => `<div class="summary-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}
async function submitPdaRequest(event) {
  event.preventDefault();
  const d = requestFormData();
  const required = ['serial', 'nome_colaborador', 'setor', 'lider', 'turno'];
  if (required.some((key) => !String(d[key] || '').trim())) { toast('Preencha todos os campos obrigatórios.', 'error'); return; }
  if (!d.asset) { toast('Número de série não encontrado no inventário.', 'error'); return; }
  if (d.asset.status !== 'Disponivel') { toast(`Este ativo não está disponível. Status atual: ${d.asset.status}.`, 'error'); return; }
  try {
    if (state.apiOnline) {
      await api(`/ativos/${d.asset.id}/entregar`, { method: 'PATCH', body: JSON.stringify(d) });
      await loadData();
    } else {
      state.assets = state.assets.map((asset) => String(asset.id) === String(d.asset.id) ? { ...asset, status: 'Em Uso', usuario_atual_nome: d.nome_colaborador, responsavel_nome: d.nome_colaborador, responsavel_setor: d.setor, responsavel_lider: d.lider, responsavel_turno: d.turno, observacoes: d.setor, entregue_em: new Date().toISOString(), atualizado_em: new Date().toISOString() } : asset);
      setStored(OFFLINE_ASSETS_KEY, state.assets);
    }
    state.pdaRequests.unshift({ id: `MOV-${Date.now().toString().slice(-6)}`, tipo: 'Entrega', ativo: d.asset.codigo_patrimonio, serial: d.serial, colaborador: d.nome_colaborador, setor: d.setor, lider: d.lider, turno: d.turno, criadoEm: new Date().toISOString(), status: 'Em Uso' });
    setStored(PDA_KEY, state.pdaRequests.slice(0, 40));
    $('pda-request-form').reset();
    renderRequests();
    renderInventory();
    renderOverview();
    updateBadges();
    toast('Entrega registrada com sucesso.');
  } catch (error) { toast(error.message, 'error'); }
}
async function returnRequestAsset(id) {
  const asset = state.assets.find((item) => String(item.id) === String(id));
  if (!asset) { toast('Ativo não encontrado.', 'error'); return; }
  try {
    if (state.apiOnline) { await api(`/ativos/${id}/devolver`, { method: 'PATCH', body: JSON.stringify({ observacao: 'Devolução registrada na aba Requisições' }) }); await loadData(); }
    else {
      state.assets = state.assets.map((item) => String(item.id) === String(id) ? { ...item, status: 'Disponivel', usuario_atual_nome: '', responsavel_nome: '', responsavel_setor: '', responsavel_lider: '', responsavel_turno: '', devolvido_em: new Date().toISOString(), atualizado_em: new Date().toISOString() } : item);
      setStored(OFFLINE_ASSETS_KEY, state.assets);
    }
    state.pdaRequests.unshift({ id: `MOV-${Date.now().toString().slice(-6)}`, tipo: 'Devolução', ativo: asset.codigo_patrimonio, serial: asset.numero_serie, colaborador: asset.usuario_atual_nome || asset.responsavel_nome || '-', setor: asset.responsavel_setor || asset.observacoes || '-', lider: asset.responsavel_lider || '-', turno: asset.responsavel_turno || '-', criadoEm: new Date().toISOString(), status: 'Devolvido' });
    setStored(PDA_KEY, state.pdaRequests.slice(0, 40));
    renderRequests();
    renderInventory();
    renderOverview();
    updateBadges();
    toast('Devolução registrada com sucesso.');
  } catch (error) { toast(error.message, 'error'); }
}
function renderPdaLists() {
  const query = state.requestSearch.toLowerCase();
  const inUse = state.assets.filter((asset) => asset.status === 'Em Uso').filter((asset) => {
    if (!query) return true;
    return [asset.numero_serie, asset.codigo_patrimonio, asset.usuario_atual_nome, asset.responsavel_nome, asset.responsavel_setor, asset.responsavel_lider, asset.observacoes]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });
  $('last-pda-requests').innerHTML = state.pdaRequests.slice(0, 4).map((r) => miniRequest(r)).join('') || emptyMini('Nenhuma movimentação registrada.');
  $('pda-requests-table').innerHTML = inUse.map((asset) => `<tr><td><strong>${escapeHtml(asset.codigo_patrimonio)}</strong><br><span class="muted">${escapeHtml(asset.numero_serie || '-')}</span></td><td>${escapeHtml(asset.tipo)}</td><td>${escapeHtml(asset.usuario_atual_nome || asset.responsavel_nome || '-')}</td><td>${escapeHtml(asset.responsavel_setor || asset.observacoes || '-')}</td><td>${escapeHtml(asset.responsavel_lider || '-')}</td><td>${escapeHtml(asset.responsavel_turno || '-')}</td><td>${asset.entregue_em ? new Date(String(asset.entregue_em).replace(' ', 'T')).toLocaleString('pt-BR') : formatDate(asset.atualizado_em)}</td><td>${statusBadge(asset.status)}</td><td><button class="btn primary" data-request-return="${asset.id}">Registrar devolução</button></td></tr>`).join('') || emptyRow(9, 'Nenhum ativo em uso no momento.');
}
function recentRequests() { return [...state.pdaRequests, ...state.pendingRequests.map((r) => ({ id: `API-${r.id}`, quantidade: 1, turno: '-', area: r.usuario_filial || '-', status: r.status || 'Pendente', criadoEm: r.solicitado_em, tipo: r.ativo_tipo || 'Ativo', solicitante: r.usuario_nome || '-' }))]; }
function miniRequest(r) { return `<div class="mini-item"><div><strong>${escapeHtml(r.tipo || r.id || 'Movimentação')}</strong><span>${escapeHtml(r.ativo || r.id || '-')} · ${escapeHtml(r.colaborador || r.solicitante || '-')} · ${escapeHtml(r.turno || '-')}</span></div>${statusBadge(r.status || 'Em análise')}</div>`; }

function renderUsers() {
  const admins = state.users.filter((u) => u.perfil === 'admin').length;
  const leaders = state.users.filter((u) => u.perfil === 'gestor').length;
  const active = state.users.filter((u) => Number(u.ativo) !== 0).length;
  $('users-metrics').innerHTML = [metric('?', 'Total de usuários', state.users.length), metric('A', 'Admins', admins), metric('L', 'Líderes', leaders), metric('?', 'Usuários ativos', active)].join('');
  renderUsersTable();
}
function renderUsersTable() {
  const q = $('user-search').value?.toLowerCase() || '';
  const data = q ? state.users.filter((u) => [u.nome, u.email, u.cargo, u.perfil].some((v) => String(v || '').toLowerCase().includes(q))) : state.users;
  $('users-table').innerHTML = data.map((u) => `<tr><td><strong>${escapeHtml(u.nome)}</strong></td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.cargo || roleLabel(u.perfil))}</td><td>${escapeHtml(u.filial || '-')}</td><td>${statusBadge(Number(u.ativo) === 0 ? 'Baixado' : 'Disponivel')}</td><td>${escapeHtml(u.ultimo_acesso || 'Hoje')}</td><td><button class="btn secondary" data-user-view="${u.id}">Visualizar</button></td></tr>`).join('') || emptyRow(7, 'Nenhum usuário encontrado.');
}
async function createUser(event) {
  event.preventDefault();
  const body = { nome: $('user-name').value.trim(), email: $('user-email').value.trim(), cargo: $('user-role').value.trim(), perfil: $('user-profile').value, senha: $('user-password').value };
  if (body.senha.length < 6) { toast('A senha temporária precisa ter pelo menos 6 caracteres.', 'error'); return; }
  try {
    if (state.apiOnline) await api('/usuarios', { method: 'POST', body: JSON.stringify(body) });
    const newUser = { id: Date.now(), ...body, filial: 'RJ02', ativo: 1, ultimo_acesso: 'Novo' };
    delete newUser.senha;
    state.users.push(newUser);
    setStored(OFFLINE_USERS_KEY, state.users);
    closeModal('user-modal');
    $('user-form').reset();
    renderUsers();
    toast('Usuário cadastrado com sucesso.');
  } catch (error) { toast(error.message, 'error'); }
}

function renderReports() {
  const c = counts();
  $('reports-metrics').innerHTML = [metric('?', 'Ativos no relatório', c.total), metric('?', 'Requisições no período', state.pdaRequests.length + state.pendingRequests.length), metric('?', 'Manutenções', c.maintenance), metric('?', 'Disponibilidade', `${c.total ? Math.round(c.available / c.total * 100) : 0}%`)].join('');
  renderStatusChart('report-status-chart', state.assets);
  renderCategoryChart();
  $('report-requests').innerHTML = recentRequests().slice(0, 6).map((r) => miniRequest(r)).join('') || emptyMini('Nenhuma requisição no período.');
  $('report-movements').innerHTML = state.audit.slice(0, 6).map((a) => `<div class="timeline-item"><strong>${escapeHtml(a.acao || 'Movimentação')}</strong>${escapeHtml(a.entidade || 'Sistema')} · ${formatDate(a.criado_em)}</div>`).join('') || emptyMini('Nenhuma movimentação.');
}
function renderCategoryChart() {
  const groups = ['PDA', 'Notebook', 'Radio', 'Coletor', 'Impressora', 'Paleteira', 'Outro'].map((type) => [type === 'Radio' ? 'Rádio' : type, state.assets.filter((a) => a.tipo === type).length]);
  const max = Math.max(1, ...groups.map((g) => g[1]));
  $('report-category-chart').innerHTML = groups.map(([label, value]) => `<div class="chart-row"><span>${label}</span><div class="chart-track"><div class="chart-fill" style="width:${Math.round(value / max * 100)}%"></div></div><b>${value}</b></div>`).join('');
}
function renderSettings() { $('settings-api-status').value = state.apiOnline ? 'API online' : 'API offline - usando dados locais'; $('settings-api-url').value = API_BASE_URL; }

async function createAsset(event) {
  event.preventDefault();
  const id = $('asset-id').value;
  const body = { codigo_patrimonio: $('asset-code').value.trim(), tipo: $('asset-type').value, modelo: $('asset-model').value.trim(), numero_serie: $('asset-serial').value.trim(), filial: $('asset-branch').value.trim(), observacoes: $('asset-notes').value.trim() };
  try {
    if (state.apiOnline) {
      if (id) await api(`/ativos/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/ativos', { method: 'POST', body: JSON.stringify(body) });
      await loadData();
    } else {
      if (id) state.assets = state.assets.map((a) => String(a.id) === String(id) ? { ...a, ...body, atualizado_em: new Date().toISOString() } : a);
      else state.assets.unshift({ id: Date.now(), ...body, status: 'Disponivel', usuario_atual_nome: '', atualizado_em: new Date().toISOString() });
      setStored(OFFLINE_ASSETS_KEY, state.assets);
    }
    closeModal('asset-modal');
    $('asset-form').reset();
    renderInventory();
    updateBadges();
    toast('Ativo salvo com sucesso.');
  } catch (error) { toast(error.message, 'error'); }
}
function openAssetModal(asset = null) {
  $('asset-modal-title').textContent = asset ? 'Editar ativo' : 'Novo ativo';
  $('asset-id').value = asset?.id || '';
  $('asset-code').value = asset?.codigo_patrimonio || '';
  $('asset-type').value = asset?.tipo || 'PDA';
  $('asset-model').value = asset?.modelo || '';
  $('asset-serial').value = asset?.numero_serie || '';
  $('asset-branch').value = asset?.filial || 'RJ02';
  $('asset-notes').value = asset?.observacoes || '';
  openModal('asset-modal');
}
async function assetOperation(id, op) {
  const map = { devolver: 'devolver', manutencao: 'manutencao', disponibilizar: 'disponibilizar', baixar: 'baixar' };
  try {
    if (state.apiOnline) { await api(`/ativos/${id}/${map[op]}`, { method: 'PATCH', body: JSON.stringify({ observacao: '' }) }); await loadData(); }
    else {
      const nextStatus = { devolver: 'Disponivel', manutencao: 'Manutencao', disponibilizar: 'Disponivel', baixar: 'Baixado' }[op];
      state.assets = state.assets.map((a) => String(a.id) === String(id) ? { ...a, status: nextStatus, usuario_atual_nome: op === 'devolver' ? '' : a.usuario_atual_nome, atualizado_em: new Date().toISOString() } : a);
      setStored(OFFLINE_ASSETS_KEY, state.assets);
    }
    renderInventory();
    renderOverview();
    toast('Status do ativo atualizado.');
  } catch (error) { toast(error.message, 'error'); }
}
async function deleteAsset(id) {
  const asset = state.assets.find((a) => String(a.id) === String(id));
  if (!asset) return toast('Ativo não encontrado.', 'error');
  const label = asset.codigo_patrimonio || asset.modelo || `ID ${asset.id}`;
  if (!confirm(`Excluir o ativo ${label}? Esta ação remove o registro do inventário.`)) return;
  try {
    if (state.apiOnline) {
      await api(`/ativos/${id}`, { method: 'DELETE' });
      await loadData();
    } else {
      state.assets = state.assets.filter((a) => String(a.id) !== String(id));
      state.selectedAssets.delete(String(id));
      setStored(OFFLINE_ASSETS_KEY, state.assets);
    }
    renderInventory();
    renderOverview();
    updateBadges();
    toast('Ativo excluído com sucesso.');
  } catch (error) {
    toast(error.message, 'error');
  }
}
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }
function emptyRow(cols, text) { return `<tr><td colspan="${cols}" class="muted">${escapeHtml(text)}</td></tr>`; }
function emptyMini(text) { return `<div class="mini-item"><span>${escapeHtml(text)}</span></div>`; }

function bindEvents() {
  $('login-form').addEventListener('submit', login);
  $('logout-btn').addEventListener('click', logout);
  $('refresh-btn').addEventListener('click', async () => { await loadData(); navigate(state.view); toast('Dados atualizados.'); });
  $('menu-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  document.querySelectorAll('.side-nav button').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  document.querySelectorAll('[data-jump]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.jump)));
  $('open-ticket-btn').addEventListener('click', () => toast('Chamado registrado para o time responsável.'));
  $('new-asset-btn').addEventListener('click', () => openAssetModal());
  $('asset-form').addEventListener('submit', createAsset);
  $('new-user-btn').addEventListener('click', () => openModal('user-modal'));
  $('user-form').addEventListener('submit', createUser);
  $('pda-request-form').addEventListener('submit', submitPdaRequest);
  ['req-serial', 'req-employee', 'req-sector', 'req-leader', 'req-shift'].forEach((id) => {
    $(id).addEventListener('input', renderRequestSummary);
    $(id).addEventListener('change', renderRequestSummary);
  });
  $('in-use-search').addEventListener('input', (event) => { state.requestSearch = event.target.value.trim(); renderPdaLists(); });
  $('cancel-request-btn').addEventListener('click', () => { $('pda-request-form').reset(); renderRequestSummary(); });
  $('view-all-requests').addEventListener('click', () => $('my-requests-panel').scrollIntoView({ behavior: 'smooth' }));
  $('user-search').addEventListener('input', renderUsersTable);
  $('asset-page-size').addEventListener('change', () => { state.assetPageSize = Number($('asset-page-size').value); state.assetPage = 1; renderAssetsTable(); });
  $('prev-assets').addEventListener('click', () => { state.assetPage -= 1; renderAssetsTable(); });
  $('next-assets').addEventListener('click', () => { state.assetPage += 1; renderAssetsTable(); });
  $('apply-filters-btn').addEventListener('click', applyFilters);
  $('clear-filters-btn').addEventListener('click', clearFilters);
  $('inventory-tabs').addEventListener('click', (e) => { if (e.target.matches('button[data-status]')) { document.querySelectorAll('#inventory-tabs button').forEach((b) => b.classList.remove('active')); e.target.classList.add('active'); state.inventoryStatus = e.target.dataset.status; $('asset-status-filter').value = state.inventoryStatus; state.assetPage = 1; renderAssetsTable(); } if (e.target.dataset.tabExtra) toast('Seção disponível na tabela e relatórios desta versão.', 'warn'); });
  $('select-all-assets').addEventListener('change', (e) => { filteredAssets().forEach((a) => e.target.checked ? state.selectedAssets.add(String(a.id)) : state.selectedAssets.delete(String(a.id))); renderAssetsTable(); });
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('change', (e) => { if (e.target.classList.contains('asset-check')) { e.target.checked ? state.selectedAssets.add(e.target.value) : state.selectedAssets.delete(e.target.value); updateBulkBar(); } });
  $('global-search').addEventListener('input', (e) => { $('asset-search').value = e.target.value; state.filters.search = e.target.value; if (state.view === 'inventory') renderAssetsTable(); });
  $('save-settings-btn').addEventListener('click', () => toast('Configurações salvas localmente.'));
}
function handleDocumentClick(e) {
  const close = e.target.closest('[data-close-modal]'); if (close) closeModal(close.dataset.closeModal);
  const edit = e.target.closest('[data-asset-edit]'); if (edit) openAssetModal(state.assets.find((a) => String(a.id) === String(edit.dataset.assetEdit)));
  const view = e.target.closest('[data-asset-view]'); if (view) toast('Visualização detalhada será aberta na próxima etapa.', 'warn');
  const del = e.target.closest('[data-asset-delete]'); if (del) deleteAsset(del.dataset.assetDelete);
  const more = e.target.closest('[data-asset-more]'); if (more) { const a = state.assets.find((x) => String(x.id) === String(more.dataset.assetMore)); const op = a.status === 'Em Uso' ? 'devolver' : a.status === 'Manutencao' ? 'disponibilizar' : 'manutencao'; assetOperation(a.id, op); }
  const requestReturn = e.target.closest('[data-request-return]'); if (requestReturn) returnRequestAsset(requestReturn.dataset.requestReturn);
  const option = e.target.closest('[data-option-action]'); if (option) manageRequestOption(option.dataset.optionKind, option.dataset.optionAction);
  const overviewFilter = e.target.closest('[data-overview-filter]'); if (overviewFilter) applyOverviewQuickFilter(overviewFilter.dataset.overviewFilter);
  const bulk = e.target.closest('[data-bulk]'); if (bulk) toast(`Ação em massa: ${bulk.dataset.bulk} (${state.selectedAssets.size} item(ns)).`, 'warn');
  const exp = e.target.closest('[data-export]'); if (exp) exportCsv();
}
function applyFilters() { state.filters = { search: $('asset-search').value.trim(), category: $('asset-category-filter').value, status: $('asset-status-filter').value, location: $('asset-location-filter').value.trim(), cd: $('asset-cd-filter').value.trim(), period: $('asset-period-filter').value }; state.assetPage = 1; renderAssetsTable(); }
function clearFilters() { ['asset-search', 'asset-category-filter', 'asset-status-filter', 'asset-location-filter', 'asset-cd-filter', 'asset-period-filter'].forEach((id) => { $(id).value = ''; }); state.filters = { search: '', category: '', status: '', location: '', cd: '', period: '' }; state.inventoryStatus = ''; document.querySelectorAll('#inventory-tabs button').forEach((b, i) => b.classList.toggle('active', i === 0)); renderAssetsTable(); }
function exportCsv() { const rows = [['patrimonio', 'tipo', 'modelo', 'serie', 'status', 'responsavel'], ...state.assets.map((a) => [a.codigo_patrimonio, a.tipo, a.modelo, a.numero_serie, a.status, a.usuario_atual_nome])]; const csv = rows.map((r) => r.map((v) => `"${String(v || '').replaceAll('"', '""')}"`).join(';')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ativos.csv'; a.click(); URL.revokeObjectURL(a.href); }

bindEvents();
restoreSession();






// -----------------------------------------------------------------------------
// Users MASTER module
// -----------------------------------------------------------------------------
const MASTER_USERS_KEY = 'controle_ativos_master_users_v1';
const MASTER_LOGS_KEY = 'controle_ativos_master_logs_v1';
const selectedUsers = new Set();
let userFilters = { search: '', role: '', status: '', unit: '', shift: '', department: '' };

const permissionModules = [
  ['dashboard', 'Visão Geral'],
  ['inventory', 'Inventário'],
  ['requests', 'Requisições'],
  ['users', 'Usuários'],
  ['reports', 'Relatórios'],
  ['settings', 'Configurações'],
];
const permissionActions = [
  ['view', 'Visualizar'], ['create', 'Criar'], ['edit', 'Editar'], ['delete', 'Excluir'],
  ['export', 'Exportar'], ['approve', 'Aprovar/Rejeitar'], ['configure', 'Configurar']
];
function allPermissions() {
  return Object.fromEntries(permissionModules.map(([module]) => [module, permissionActions.map(([action]) => action)]));
}
function profilePermissions(role) {
  if (role === 'master') return allPermissions();
  const base = {
    admin: { dashboard:['view'], inventory:['view','create','edit','delete','export','configure'], requests:['view','create','edit','approve','export'], users:['view','create','edit','delete','export'], reports:['view','export'], settings:['view'] },
    gestor: { dashboard:['view'], inventory:['view'], requests:['view','create'], users:[], reports:['view'], settings:[] },
    operador: { dashboard:['view'], inventory:['view'], requests:['view'], users:[], reports:[], settings:[] },
    visualizador: { dashboard:['view'], inventory:['view'], requests:['view'], users:[], reports:['view'], settings:[] },
    suporte_ti: { dashboard:['view'], inventory:['view','create','edit','export','configure'], requests:['view','approve','edit'], users:['view'], reports:['view','export'], settings:[] },
  }[role] || {};
  return Object.fromEntries(permissionModules.map(([module]) => [module, base[module] || []]));
}
function normalizeUser(user) {
  const role = user.role || user.perfil || 'operador';
  return {
    id: String(user.id || user.registration || generateUserId()),
    name: user.name || user.nome || 'Usuário sem nome',
    email: user.email || '',
    registration: user.registration || user.matricula || String(user.id || generateUserId()),
    phone: user.phone || '',
    department: user.department || user.filial || 'Operação',
    role,
    jobTitle: user.jobTitle || user.cargo || roleLabel(role),
    shift: user.shift || 'Administrativo',
    unit: user.unit || user.filial || 'RJ2',
    status: user.status || (Number(user.ativo) === 0 ? 'Inativo' : 'Ativo'),
    permissions: user.permissions || profilePermissions(role),
    isMaster: Boolean(user.isMaster || role === 'master'),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt || user.criado_em || new Date().toISOString(),
    createdBy: user.createdBy || 'system',
    lastLoginAt: user.lastLoginAt || user.ultimo_acesso || null,
    deletedAt: user.deletedAt || null,
    deletedBy: user.deletedBy || null,
  };
}
function initialMasterUsers() {
  return [
    normalizeUser({ id:'USR-000001', name:'Matheus Rodrigues', email:'master@shopee.com', registration:'MASTER-001', department:'Administração do Sistema', role:'master', jobTitle:'Dono do Sistema', shift:'Administrativo', unit:'RJ2', status:'Ativo', isMaster:true, permissions:allPermissions(), createdAt:'2026-07-03T00:00:00', createdBy:'system' }),
    normalizeUser({ id:'USR-000002', name:'Rafael Silva', email:'rafael@shopee.com', registration:'ADM-001', department:'Operações', role:'admin', jobTitle:'Administrador', shift:'Administrativo', unit:'RJ2', status:'Ativo' }),
    normalizeUser({ id:'USR-000003', name:'João Silva', email:'joao@shopee.com', registration:'LID-001', department:'Outbound', role:'gestor', jobTitle:'Líder', shift:'T2', unit:'RJ2', status:'Ativo' }),
    normalizeUser({ id:'USR-000004', name:'Maria Santos', email:'maria@shopee.com', registration:'OP-001', department:'Inbound', role:'operador', jobTitle:'Operador', shift:'T1', unit:'RJ2', status:'Ativo' }),
    normalizeUser({ id:'USR-000005', name:'Carlos Lima', email:'carlos@shopee.com', registration:'TI-001', department:'Suporte TI', role:'suporte_ti', jobTitle:'Analista de TI', shift:'Administrativo', unit:'RJ2', status:'Ativo' }),
    normalizeUser({ id:'USR-000006', name:'Ana Ferreira', email:'ana.ferreira@shopee.com', registration:'VIS-001', department:'Gestão', role:'visualizador', jobTitle:'Visualizador', shift:'Administrativo', unit:'RJ2', status:'Inativo' }),
  ];
}
function loadUsersFromStorage() {
  const stored = getStored(MASTER_USERS_KEY, null);
  const normalized = (stored && stored.length ? stored : initialMasterUsers()).map(normalizeUser);
  if (!normalized.some((u) => u.isMaster)) normalized.unshift(initialMasterUsers()[0]);
  state.users = normalized;
  saveUsersToStorage();
}
function saveUsersToStorage() { setStored(MASTER_USERS_KEY, state.users); }
function generateUserId() { return `USR-${String(Date.now()).slice(-6)}`; }
function getCurrentUser() { return normalizeUser(state.user || initialMasterUsers()[0]); }
function isMasterUser(user = getCurrentUser()) { return user.isMaster || user.role === 'master' || user.perfil === 'master'; }
function currentUserHasPermission(module, action) {
  const user = getCurrentUser();
  if (isMasterUser(user)) return true;
  const permissions = user.permissions || profilePermissions(user.role || user.perfil);
  return (permissions[module] || []).includes(action);
}
function canManageUser(targetUser) {
  const current = getCurrentUser();
  const target = normalizeUser(targetUser);
  if (isMasterUser(current)) return true;
  if (isMasterUser(target)) return false;
  if (['admin'].includes(current.role || current.perfil)) return ['gestor','operador','visualizador','suporte_ti','colaborador'].includes(target.role);
  return false;
}
function saveAuditLog(action, targetUserId, details = {}) {
  const logs = getStored(MASTER_LOGS_KEY, []);
  logs.unshift({ id:`LOG-${Date.now()}`, at:new Date().toISOString(), executor:getCurrentUser().name, action, targetUserId, details, origin: state.apiOnline ? 'API' : 'localStorage' });
  setStored(MASTER_LOGS_KEY, logs.slice(0, 300));
}
function renderAuditLogs() {
  const logs = getStored(MASTER_LOGS_KEY, []);
  $('access-logs-list').innerHTML = logs.map((log) => `<div class="log-item"><strong>${escapeHtml(log.action)}</strong><span>${formatDate(log.at)} · Executor: ${escapeHtml(log.executor)} · Alvo: ${escapeHtml(log.targetUserId || '-')}</span><small>${escapeHtml(JSON.stringify(log.details || {}))} · ${escapeHtml(log.origin)}</small></div>`).join('') || emptyMini('Nenhum log registrado.');
}
function showToast(type, message) { toast(message, type === 'erro' ? 'error' : type === 'alerta' ? 'warn' : 'success'); }
function userRoleLabel(role) { return ({ master:'MASTER', admin:'Administrador', gestor:'Líder', operador:'Operador', visualizador:'Visualizador', suporte_ti:'Suporte TI', colaborador:'Operador' })[role] || role; }
function roleBadge(role) { const cls = ({ master:'master', admin:'admin', gestor:'leader', operador:'operator', visualizador:'viewer', suporte_ti:'support' })[role] || 'operator'; return `<span class="role-badge ${cls}">${userRoleLabel(role)}</span>`; }
function userStatusBadge(status) { const cls = ({ Ativo:'available', Inativo:'retired', Bloqueado:'retired', Pendente:'pending', 'Excluído':'retired' })[status] || 'pending'; return `<span class="badge ${cls}">${escapeHtml(status)}</span>`; }
function initials(name) { return String(name || 'U').split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase(); }
function filteredUsers() {
  return state.users.filter((u) => {
    if (u.status === 'Excluído' && userFilters.status !== 'Excluído') return false;
    const q = userFilters.search.toLowerCase();
    const matchesSearch = !q || [u.name, u.email, u.registration, u.department].some((v) => String(v || '').toLowerCase().includes(q));
    return matchesSearch && (!userFilters.role || u.role === userFilters.role) && (!userFilters.status || u.status === userFilters.status) && (!userFilters.unit || String(u.unit).toLowerCase().includes(userFilters.unit.toLowerCase())) && (!userFilters.shift || u.shift === userFilters.shift) && (!userFilters.department || String(u.department).toLowerCase().includes(userFilters.department.toLowerCase()));
  });
}
function renderUsers() { renderUsersPage(); }
function renderUsersPage() {
  loadUsersFromStorage();
  const active = state.users.filter((u) => u.status === 'Ativo').length;
  const blocked = state.users.filter((u) => u.status === 'Bloqueado').length;
  const admins = state.users.filter((u) => ['master','admin'].includes(u.role)).length;
  const leaders = state.users.filter((u) => u.role === 'gestor').length;
  $('users-metrics').innerHTML = [metric('?','Total de usuários',state.users.length), metric('?','Usuários ativos',active), metric('!','Usuários bloqueados',blocked), metric('A','Administradores',admins), metric('L','Líderes',leaders), metric('?','Últimos acessos hoje',state.users.filter((u) => u.lastLoginAt === 'Hoje').length)].join('');
  renderUsersTable();
}
function renderUsersTable() {
  const data = filteredUsers();
  $('users-table').innerHTML = data.map((u) => {
    const disabledMaster = u.isMaster ? 'disabled title="O usuário MASTER não pode ser excluído ou rebaixado."' : '';
    const canManage = canManageUser(u);
    const checked = selectedUsers.has(u.id) ? 'checked' : '';
    return `<tr class="${u.isMaster ? 'master-row' : ''}"><td><input type="checkbox" class="user-check" value="${u.id}" ${checked} ${u.isMaster ? 'disabled' : ''}></td><td><div class="user-cell"><div class="user-avatar ${u.isMaster ? 'master' : ''}">${initials(u.name)}</div><div><strong>${escapeHtml(u.name)}</strong><span>${escapeHtml(u.email)}</span></div></div></td><td>${escapeHtml(u.registration)}</td><td>${roleBadge(u.role)}</td><td>${escapeHtml(u.department)}</td><td>${escapeHtml(u.shift)}</td><td>${escapeHtml(u.unit)}</td><td>${userStatusBadge(u.status)}</td><td>${escapeHtml(u.lastLoginAt || '-')}</td><td>${formatDate(u.createdAt)}</td><td><div class="row-actions"><button class="btn secondary" data-user-view="${u.id}">Visualizar</button>${canManage ? `<button class="btn secondary" data-user-edit="${u.id}">Editar</button><button class="btn secondary" data-user-reset="${u.id}">Resetar senha</button><button class="btn secondary" data-user-toggle="${u.id}">${u.status === 'Ativo' ? 'Desativar' : 'Ativar'}</button><button class="btn danger" data-user-delete="${u.id}" ${disabledMaster}>Excluir</button>` : ''}</div></td></tr>`;
  }).join('') || emptyRow(11, 'Nenhum usuário encontrado.');
  updateUserBulkBar();
}
function updateUserBulkBar() { $('user-bulk-bar').hidden = selectedUsers.size === 0; $('selected-users-count').textContent = String(selectedUsers.size); }
function renderPermissionsMatrix(user = null) {
  const role = $('user-profile').value || user?.role || 'operador';
  const permissions = user?.permissions || profilePermissions(role);
  const locked = role === 'master' || !isMasterUser();
  $('permissions-section').hidden = !isMasterUser() && role !== 'master';
  $('permissions-matrix').innerHTML = `<table class="permission-table"><thead><tr><th>Módulo</th>${permissionActions.map(([,label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${permissionModules.map(([module,label]) => `<tr><td><strong>${label}</strong></td>${permissionActions.map(([action]) => `<td><input type="checkbox" data-permission-module="${module}" data-permission-action="${action}" ${(permissions[module] || []).includes(action) ? 'checked' : ''} ${locked ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function collectPermissions() {
  if ($('user-profile').value === 'master') return allPermissions();
  const permissions = Object.fromEntries(permissionModules.map(([m]) => [m, []]));
  document.querySelectorAll('[data-permission-module]').forEach((input) => { if (input.checked) permissions[input.dataset.permissionModule].push(input.dataset.permissionAction); });
  return permissions;
}
function openCreateUserModal() {
  if (!currentUserHasPermission('users','create')) return showToast('erro','Você não tem permissão para criar usuários.');
  $('user-form').reset(); $('user-edit-id').value = ''; $('user-modal-title').textContent = 'Novo usuário'; $('user-submit-btn').textContent = 'Criar usuário'; configureProfileOptions(); renderPermissionsMatrix(); openModal('user-modal');
}
function openEditUserModal(userId) {
  const user = state.users.find((u) => u.id === userId); if (!user || !canManageUser(user)) return showToast('erro','Você não pode editar este usuário.');
  $('user-edit-id').value = user.id; $('user-modal-title').textContent = 'Editar usuário'; $('user-submit-btn').textContent = 'Salvar alterações';
  $('user-name').value = user.name; $('user-email').value = user.email; $('user-registration').value = user.registration; $('user-phone').value = user.phone; $('user-department').value = user.department; $('user-role').value = user.jobTitle; $('user-shift').value = user.shift; $('user-unit').value = user.unit; $('user-status').value = user.status; $('user-password').value = ''; $('user-password-confirm').value = '';
  configureProfileOptions(user.role); $('user-profile').value = user.role; renderPermissionsMatrix(user); openModal('user-modal');
}
function openViewUserModal(userId) {
  const user = state.users.find((u) => u.id === userId); if (!user) return;
  $('user-view-content').innerHTML = `<div><b>Nome</b><span>${escapeHtml(user.name)}</span></div><div><b>E-mail</b><span>${escapeHtml(user.email)}</span></div><div><b>Matrícula</b><span>${escapeHtml(user.registration)}</span></div><div><b>Perfil</b><span>${roleBadge(user.role)}</span></div><div><b>Setor</b><span>${escapeHtml(user.department)}</span></div><div><b>Turno</b><span>${escapeHtml(user.shift)}</span></div><div><b>Unidade</b><span>${escapeHtml(user.unit)}</span></div><div><b>Status</b><span>${userStatusBadge(user.status)}</span></div><div><b>Último acesso</b><span>${escapeHtml(user.lastLoginAt || '-')}</span></div><div><b>Criado em</b><span>${formatDate(user.createdAt)}</span></div>`;
  openModal('user-view-modal');
}
function openResetPasswordModal(userId) { const user = state.users.find((u) => u.id === userId); if (!user || !canManageUser(user)) return showToast('erro','Você não pode resetar a senha deste usuário.'); $('password-user-id').value = userId; $('password-form').reset(); openModal('password-modal'); }
function confirmDeleteUser(userId) { const user = state.users.find((u) => u.id === userId); if (!user || !canManageUser(user) || user.isMaster || user.id === String(getCurrentUser().id)) return showToast('erro','Este usuário não pode ser excluído.'); $('delete-user-id').value = userId; openModal('delete-user-modal'); }
function createUserRecord(data) { state.users.push(data); saveUsersToStorage(); saveAuditLog('Usuário criado', data.id, { email:data.email, role:data.role }); }
function updateUser(userId, data) { const index = state.users.findIndex((u) => u.id === userId); if (index < 0) return; const old = state.users[index]; if (old.isMaster && data.role !== 'master') return showToast('erro','O MASTER não pode ser rebaixado.'); state.users[index] = { ...old, ...data }; saveUsersToStorage(); saveAuditLog('Usuário editado', userId, { role:data.role, status:data.status }); }
function deleteUser(userId) { const user = state.users.find((u) => u.id === userId); if (!user || user.isMaster) return showToast('erro','O MASTER não pode ser excluído.'); updateUser(userId, { status:'Excluído', deletedAt:new Date().toISOString(), deletedBy:getCurrentUser().id }); saveAuditLog('Usuário excluído', userId); }
function toggleUserStatus(userId) { const user = state.users.find((u) => u.id === userId); if (!user || user.isMaster) return showToast('erro','O MASTER não pode ser bloqueado ou desativado.'); updateUser(userId, { status: user.status === 'Ativo' ? 'Inativo' : 'Ativo' }); saveAuditLog('Status alterado', userId, { status:user.status }); renderUsersTable(); }
function resetUserPassword(userId, newPassword) { saveAuditLog('Senha resetada', userId, { mustChangePassword:$('force-password-change').checked }); showToast('sucesso','Senha temporária atualizada com sucesso.'); }
function configureProfileOptions(selected = 'operador') {
  const profiles = [['admin','Administrador'],['gestor','Líder'],['operador','Operador'],['visualizador','Visualizador'],['suporte_ti','Suporte TI']];
  if (isMasterUser()) profiles.unshift(['master','MASTER']);
  $('user-profile').innerHTML = profiles.map(([value,label]) => `<option value="${value}">${label}</option>`).join(''); $('user-profile').value = selected;
}
async function createUser(event) {
  event.preventDefault();
  const id = $('user-edit-id').value;
  const password = $('user-password').value; const confirm = $('user-password-confirm').value;
  if (!id && !password) return showToast('erro','Senha temporária obrigatória.');
  if (password || confirm) { if (password.length < 6) return showToast('erro','A senha deve ter ao menos 6 caracteres.'); if (password !== confirm) return showToast('erro','Senha e confirmação precisam ser iguais.'); }
  const email = $('user-email').value.trim(); const registration = $('user-registration').value.trim();
  if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== id)) return showToast('erro','E-mail já cadastrado.');
  if (state.users.some((u) => u.registration === registration && u.id !== id)) return showToast('erro','Matrícula já cadastrada.');
  const role = $('user-profile').value;
  const data = normalizeUser({ id: id || generateUserId(), name:$('user-name').value.trim(), email, registration, phone:$('user-phone').value.trim(), department:$('user-department').value.trim(), role, jobTitle:$('user-role').value.trim(), shift:$('user-shift').value, unit:$('user-unit').value.trim(), status:$('user-status').value, permissions:collectPermissions(), isMaster: role === 'master', mustChangePassword:$('user-must-change').checked, createdAt:id ? undefined : new Date().toISOString(), createdBy:getCurrentUser().id });
  if (id) updateUser(id, data); else createUserRecord(data);
  closeModal('user-modal'); renderUsersPage(); showToast('sucesso', id ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso');
}
function applyUserFilters() { userFilters = { search:$('user-search').value.trim(), role:$('user-filter-role').value, status:$('user-filter-status').value, unit:$('user-filter-unit').value.trim(), shift:$('user-filter-shift').value, department:$('user-filter-department').value.trim() }; renderUsersTable(); }
function clearUserFilters() { ['user-search','user-filter-role','user-filter-status','user-filter-unit','user-filter-shift','user-filter-department'].forEach((id) => $(id).value = ''); userFilters = { search:'', role:'', status:'', unit:'', shift:'', department:'' }; renderUsersTable(); }
function bulkUserAction(action) { const ids = [...selectedUsers]; ids.forEach((id) => { const u = state.users.find((x) => x.id === id); if (!u || u.isMaster) return; if (action === 'activate') updateUser(id, { status:'Ativo' }); if (action === 'deactivate') updateUser(id, { status:'Inativo' }); if (action === 'block') updateUser(id, { status:'Bloqueado' }); if (action === 'delete') deleteUser(id); }); selectedUsers.clear(); renderUsersPage(); saveAuditLog('Ação em massa', null, { action, total:ids.length }); }

// Extra bindings for MASTER user module
function bindMasterUserEvents() {
  $('new-user-btn')?.addEventListener('click', openCreateUserModal);
  $('export-users-btn')?.addEventListener('click', () => exportUsersCsv());
  $('access-logs-btn')?.addEventListener('click', () => { renderAuditLogs(); openModal('logs-modal'); });
  $('refresh-users-btn')?.addEventListener('click', () => { renderUsersPage(); showToast('sucesso','Usuários atualizados.'); });
  $('apply-user-filters-btn')?.addEventListener('click', applyUserFilters);
  $('clear-user-filters-btn')?.addEventListener('click', clearUserFilters);
  $('user-search')?.addEventListener('input', () => { userFilters.search = $('user-search').value.trim(); renderUsersTable(); });
  $('user-profile')?.addEventListener('change', () => renderPermissionsMatrix());
  $('select-all-users')?.addEventListener('change', (event) => {
    filteredUsers().forEach((u) => { if (!u.isMaster) event.target.checked ? selectedUsers.add(u.id) : selectedUsers.delete(u.id); });
    renderUsersTable();
  });
  $('password-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const pass = $('new-temp-password').value;
    const confirm = $('new-temp-password-confirm').value;
    if (pass.length < 6) return showToast('erro','A senha deve ter ao menos 6 caracteres.');
    if (pass !== confirm) return showToast('erro','Senha e confirmação precisam ser iguais.');
    resetUserPassword($('password-user-id').value, pass);
    closeModal('password-modal');
  });
  $('confirm-delete-user-btn')?.addEventListener('click', () => { deleteUser($('delete-user-id').value); closeModal('delete-user-modal'); renderUsersPage(); showToast('sucesso','Usuário excluído com segurança.'); });
  document.addEventListener('change', (event) => {
    if (event.target.classList.contains('user-check')) {
      event.target.checked ? selectedUsers.add(event.target.value) : selectedUsers.delete(event.target.value);
      updateUserBulkBar();
    }
  });
  document.addEventListener('click', (event) => {
    const view = event.target.closest('[data-user-view]'); if (view) openViewUserModal(view.dataset.userView);
    const edit = event.target.closest('[data-user-edit]'); if (edit) openEditUserModal(edit.dataset.userEdit);
    const reset = event.target.closest('[data-user-reset]'); if (reset) openResetPasswordModal(reset.dataset.userReset);
    const toggle = event.target.closest('[data-user-toggle]'); if (toggle) toggleUserStatus(toggle.dataset.userToggle);
    const del = event.target.closest('[data-user-delete]'); if (del && !del.disabled) confirmDeleteUser(del.dataset.userDelete);
    const bulk = event.target.closest('[data-user-bulk]'); if (bulk) bulkUserAction(bulk.dataset.userBulk);
  });
}
function exportUsersCsv() {
  const rows = [['id','nome','email','matricula','perfil','setor','turno','unidade','status'], ...state.users.map((u) => [u.id,u.name,u.email,u.registration,userRoleLabel(u.role),u.department,u.shift,u.unit,u.status])];
  const csv = rows.map((r) => r.map((v) => `"${String(v || '').replaceAll('"','""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'usuarios_controle_ativos.csv'; a.click(); URL.revokeObjectURL(a.href);
  saveAuditLog('Usuários exportados', null, { total: state.users.length });
}
bindMasterUserEvents();

function isManager() { return state.user && ['master', 'admin', 'suporte_ti'].includes(state.user.perfil || state.user.role); }
function isAdmin() { return state.user && ['master', 'admin'].includes(state.user.perfil || state.user.role); }

// -----------------------------------------------------------------------------
// Operational Overview PDA module
// -----------------------------------------------------------------------------
const OVERVIEW_MOVEMENTS_KEY = 'controle_ativos_overview_movements_v2';
const OVERVIEW_FILTERS_KEY = 'controle_ativos_overview_filters_v1';
let selectedPendingMovementId = null;
let overviewFilters = { date: '', shift: '', sector: '', unit: '', status: '' };

const overviewSectors = ['Inbound', 'Outbound', 'Sortation', 'Expedição', 'Nurse', 'Tratativas', 'Inventário', 'Administrativo', 'Outro'];
const overviewLeaders = ['Rafael Souza', 'Juliana Costa', 'Marcos Lima', 'Fernanda Santos', 'Carlos Oliveira'];
const overviewEmployees = ['João Silva', 'Maria Santos', 'Pedro Martins', 'Ana Ferreira', 'Bruno Almeida', 'Thaís Vieira', 'Lucas Mendes', 'Camila Rocha', 'Diego Pereira', 'Larissa Gomes'];

function renderOverview() { renderOverviewPage(); }
function renderOverviewPage() {
  loadOverviewData();
  const summary = calculateOperationalSummary();
  const executive = calculateExecutiveOverview();
  renderSmartAlerts(executive);
  renderMainKpiCards(executive);
  renderScoreAndHealth(executive);
  renderAssetTypeDistribution(executive);
  renderSectorUtilization(executive);
  renderPendingReturnsPanel(executive);
  renderLeadershipRanking(executive);
  renderUpcomingMaintenance(executive);
  renderRecentAssetMovements(executive);
  renderFinancialSummary(executive);
}
function loadOverviewData() {
  overviewFilters = getStored(OVERVIEW_FILTERS_KEY, overviewFilters);
  if ($('overview-date')) $('overview-date').value = overviewFilters.date || new Date().toISOString().slice(0, 10);
  if ($('overview-shift')) $('overview-shift').value = overviewFilters.shift || '';
  if ($('overview-sector')) $('overview-sector').value = overviewFilters.sector || '';
  if ($('overview-unit')) $('overview-unit').value = overviewFilters.unit || '';
  if ($('overview-status')) $('overview-status').value = overviewFilters.status || '';
}
function saveOverviewDataToStorage(data) { setStored(OVERVIEW_MOVEMENTS_KEY, data); }
function getOverviewMovements() { return getStored(OVERVIEW_MOVEMENTS_KEY, []).map(enrichMovement); }
function filteredOverviewMovements() {
  const f = overviewFilters;
  return getOverviewMovements().filter((m) => {
    const dateOk = !f.date || m.withdrawnAt.slice(0, 10) === f.date || (m.returnedAt || '').slice(0, 10) === f.date;
    return dateOk && (!f.shift || m.shift === f.shift) && (!f.sector || m.sector === f.sector) && (!f.unit || m.unit.toLowerCase().includes(f.unit.toLowerCase())) && (!f.status || m.status === f.status);
  });
}
function enrichMovement(m) {
  const now = new Date();
  const expected = new Date(m.expectedReturnAt);
  let status = m.status;
  let delayHours = Number(m.delayHours || 0);
  if (!m.returnedAt && ['Em operação', 'Pendente devolução'].includes(status) && expected < now) status = 'Pendente devolução';
  if (!m.returnedAt && expected < now) delayHours = Math.max(delayHours, Math.ceil((now - expected) / 3600000));
  if (!m.returnedAt && delayHours >= 2) status = 'Em atraso';
  return { ...m, status, delayHours };
}
function calculateOperationalSummary() {
  const movements = filteredOverviewMovements();
  const allPdas = state.assets.filter(isPdaAsset).length;
  const inOperation = movements.filter((m) => ['Em operação', 'Pendente devolução', 'Em atraso'].includes(m.status)).length;
  const pending = movements.filter((m) => ['Pendente devolução', 'Em atraso'].includes(m.status)).length;
  const delayed = movements.filter((m) => m.status === 'Em atraso').length;
  const returned = movements.filter((m) => m.status === 'Devolvido').length;
  const maintenance = movements.filter((m) => m.status === 'Manutenção').length;
  const available = Math.max(0, allPdas - inOperation - maintenance);
  const withdrawalsToday = movements.filter((m) => m.withdrawnAt.slice(0, 10) === ($('overview-date')?.value || new Date().toISOString().slice(0,10))).length;
  const returnsToday = movements.filter((m) => (m.returnedAt || '').slice(0, 10) === ($('overview-date')?.value || new Date().toISOString().slice(0,10))).length;
  const returnRate = calculateReturnRate(movements);
  const avgUse = calculateAverageUseHours(movements);
  const sectorStats = calculatePdasBySector(movements);
  const leaderStats = calculatePendingReturnsByLeader(movements);
  const topSector = sectorStats[0]?.sector || '-';
  const topLeader = leaderStats[0]?.leaderName || '-';
  const shiftRisk = calculateShiftRisk(available);
  const health = calculateOperationalHealth({ allPdas, available, inOperation, pending, delayed, maintenance, shiftRisk });
  return { allPdas, available, inOperation, pending, delayed, returned, maintenance, withdrawalsToday, returnsToday, returnRate, avgUse, topSector, topLeader, health, movements, sectorStats, leaderStats, shiftRisk };
}
function calculateReturnRate(movements = filteredOverviewMovements()) {
  const expected = movements.filter((m) => m.returnedAt || ['Pendente devolução', 'Em atraso'].includes(m.status));
  const returnedOnTime = movements.filter((m) => m.returnedAt && new Date(m.returnedAt) <= new Date(m.expectedReturnAt)).length;
  return expected.length ? Math.round((returnedOnTime / expected.length) * 100) : 0;
}
function calculateAverageUseHours(movements = filteredOverviewMovements()) {
  const durations = movements.map((m) => ((new Date(m.returnedAt || new Date()) - new Date(m.withdrawnAt)) / 3600000)).filter((v) => Number.isFinite(v) && v >= 0);
  return durations.length ? Math.round((durations.reduce((a,b) => a + b, 0) / durations.length) * 10) / 10 : 0;
}
function calculateOperationalHealth({ allPdas, available, pending, delayed, maintenance, shiftRisk }) {
  if (!allPdas) return { label: 'Sem dados', score: 0, cls: 'neutral' };
  const hasCriticalGap = shiftRisk.some((r) => r.status === 'Crítico');
  if (delayed >= 5 || available < 15 || hasCriticalGap) return { label: 'Crítico', score: 42, cls: 'danger' };
  if (pending >= 6 || maintenance >= 5 || available < 30) return { label: 'Atenção', score: 72, cls: 'warn' };
  return { label: 'Saudável', score: 94, cls: 'success' };
}
function calculatePdasBySector(movements = filteredOverviewMovements()) {
  const map = new Map();
  overviewSectors.forEach((sector) => map.set(sector, { sector, inOperation: 0, returned: 0, pending: 0, delayed: 0, total: 0, returnRate: 100 }));
  movements.forEach((m) => {
    const row = map.get(m.sector) || { sector: m.sector, inOperation: 0, returned: 0, pending: 0, delayed: 0, total: 0, returnRate: 100 };
    row.total += 1;
    if (['Em operação', 'Pendente devolução', 'Em atraso'].includes(m.status)) row.inOperation += 1;
    if (m.status === 'Devolvido') row.returned += 1;
    if (['Pendente devolução', 'Em atraso'].includes(m.status)) row.pending += 1;
    if (m.status === 'Em atraso') row.delayed += 1;
    map.set(m.sector, row);
  });
  return [...map.values()].map((row) => ({ ...row, returnRate: row.returned + row.pending ? Math.round(row.returned / (row.returned + row.pending) * 100) : 0, status: row.delayed || row.pending >= 4 ? 'Crítico' : row.pending >= 2 ? 'Atenção' : 'Normal' })).sort((a,b) => b.inOperation - a.inOperation || b.pending - a.pending);
}
function calculatePendingReturnsByLeader(movements = filteredOverviewMovements()) {
  const map = new Map();
  movements.forEach((m) => {
    const row = map.get(m.leaderName) || { leaderName: m.leaderName, leaderId: m.leaderId, sector: m.sector, employees: new Set(), withdrawn: 0, returned: 0, pending: 0, delayed: 0, lastMovement: null, movements: [] };
    row.employees.add(m.employeeName);
    row.withdrawn += ['Retirada', 'Manutenção'].includes(m.type) ? 1 : 0;
    if (m.status === 'Devolvido') row.returned += 1;
    if (['Pendente devolução', 'Em atraso'].includes(m.status)) row.pending += 1;
    if (m.status === 'Em atraso') row.delayed += 1;
    row.lastMovement = !row.lastMovement || new Date(m.withdrawnAt) > new Date(row.lastMovement) ? m.withdrawnAt : row.lastMovement;
    row.movements.push(m);
    map.set(m.leaderName, row);
  });
  return [...map.values()].map((row) => ({ ...row, employeesCount: row.employees.size, status: row.delayed || row.pending >= 3 ? 'Crítico' : row.pending >= 1 ? 'Atenção' : 'Em dia' })).sort((a,b) => b.pending - a.pending || b.delayed - a.delayed);
}
function calculateShiftRisk(availableOverride = null) {
  const totalPdas = state.assets.filter(isPdaAsset).length;
  if (!totalPdas) return [];
  const available = availableOverride ?? calculateOperationalSummary().available;
  const demand = { T1: 45, T2: 60, T3: 38 };
  return Object.entries(demand).map(([shift, required]) => {
    const gap = available - required;
    return { shift, required, available, gap, status: gap >= 8 ? 'OK' : gap >= 0 ? 'Atenção' : 'Crítico' };
  });
}
function calculateExecutiveOverview() {
  const c = counts();
  const pending = state.assets.filter((asset) => asset.status === 'Em Uso');
  const retired = state.assets.filter((asset) => asset.status === 'Baixado');
  const total = Math.max(1, c.total);
  const utilizationRate = Math.round((c.inUse / total) * 1000) / 10;
  const availabilityRate = Math.round((c.available / total) * 1000) / 10;
  const maintenanceRate = c.maintenance / total;
  const pendingRate = pending.length / total;
  const retiredRate = retired.length / total;
  const score = Math.max(0, Math.min(100, Math.round(100 - (maintenanceRate * 42) - (pendingRate * 28) - (retiredRate * 36))));
  const health = Math.max(0, Math.min(100, Math.round(availabilityRate - (maintenanceRate * 18) - (retiredRate * 20) + 8)));
  const sectorStats = assetSectorStats();
  const inUseSectorStats = assetInUseSectorStats(pending);
  const typeStats = assetTypeStats();
  const leaderStats = assetLeaderStats(pending);
  const topSector = sectorStats[0] || null;
  const topLeader = leaderStats[0] || null;
  const pendingRank = pendingAssetsRank(pending);
  return { ...c, pendingAssets: pending, pendingRank, retiredAssets: retired, pending: pending.length, utilizationRate, availabilityRate, score, health, sectorStats, inUseSectorStats, typeStats, leaderStats, topSector, topLeader };
}
function renderMainKpiCards(summary) {
  const cards = [
    executiveKpiCard('Total de ativos', summary.total, '100% do inventário', '?', 'neutral', 'inventory'),
    executiveKpiCard('Disponíveis', summary.available, `${summary.availabilityRate}% disponíveis`, '?', 'success', 'available'),
    executiveKpiCard('Em uso', summary.inUse, `${summary.utilizationRate}% em uso`, '?', 'info', 'in-use'),
    executiveKpiCard('Em manutenção', summary.maintenance, `${percentage(summary.maintenance, summary.total)}% do inventário`, '?', summary.maintenance ? 'warn' : 'neutral', 'maintenance'),
    executiveKpiCard('Pendências de devolução', summary.pending, `${percentage(summary.pending, summary.total)}% do inventário`, '?', summary.pending ? 'warn' : 'success', 'pending'),
    executiveKpiCard('Extraviados/Inativos', summary.retired, `${percentage(summary.retired, summary.total)}% do inventário`, '?', summary.retired ? 'danger' : 'neutral', 'retired'),
    executiveKpiCard('Taxa de utilização', `${summary.utilizationRate}%`, 'Ativos vinculados à operação', '?', 'info', 'utilization'),
    executiveKpiCard('Disponibilidade geral', `${summary.availabilityRate}%`, 'Prontos para uso imediato', '?', summary.availabilityRate < 75 ? 'warn' : 'success', 'availability'),
  ];
  $('overview-main-kpis').innerHTML = cards.join('');
}
function executiveKpiCard(title, value, detail, icon, tone, filter) {
  return `<article class="metric-card op executive ${tone}" data-overview-filter="${filter}"><div class="metric-top"><span>${escapeHtml(title)}</span><div class="metric-icon">${escapeHtml(icon)}</div></div><b>${escapeHtml(value)}</b><small>${escapeHtml(detail)}</small></article>`;
}
function percentage(value, total) { return total ? Math.round((value / total) * 1000) / 10 : 0; }
function assetTypeStats() {
  const map = new Map();
  state.assets.forEach((asset) => {
    const type = asset.tipo || 'Outro';
    const row = map.get(type) || { type, total: 0, available: 0, inUse: 0, maintenance: 0, retired: 0 };
    row.total += 1;
    if (asset.status === 'Disponivel') row.available += 1;
    if (asset.status === 'Em Uso') row.inUse += 1;
    if (asset.status === 'Manutencao') row.maintenance += 1;
    if (asset.status === 'Baixado') row.retired += 1;
    map.set(type, row);
  });
  const order = ['PDA', 'Notebook', 'Radio', 'Paleteira', 'Coletor', 'Impressora', 'Outro'];
  return [...map.values()].sort((a, b) => {
    const indexA = order.indexOf(a.type);
    const indexB = order.indexOf(b.type);
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB) || a.type.localeCompare(b.type);
  });
}
function assetSectorStats() {
  const map = new Map();
  state.assets.forEach((asset) => {
    const sector = assetArea(asset);
    const row = map.get(sector) || { sector, total: 0, available: 0, inUse: 0, maintenance: 0, retired: 0 };
    row.total += 1;
    if (asset.status === 'Disponivel') row.available += 1;
    if (asset.status === 'Em Uso') row.inUse += 1;
    if (asset.status === 'Manutencao') row.maintenance += 1;
    if (asset.status === 'Baixado') row.retired += 1;
    map.set(sector, row);
  });
  return [...map.values()].sort((a, b) => b.total - a.total || a.sector.localeCompare(b.sector));
}
function assetInUseSectorStats(assets) {
  const map = new Map();
  assets.forEach((asset) => {
    const sector = asset.responsavel_setor || asset.observacoes || 'Sem setor';
    const row = map.get(sector) || { sector, inUse: 0, leaders: new Set(), employees: new Set() };
    row.inUse += 1;
    if (asset.responsavel_lider) row.leaders.add(asset.responsavel_lider);
    if (asset.usuario_atual_nome || asset.responsavel_nome) row.employees.add(asset.usuario_atual_nome || asset.responsavel_nome);
    map.set(sector, row);
  });
  return [...map.values()].map((row) => ({ ...row, leaders: row.leaders.size, employees: row.employees.size })).sort((a, b) => b.inUse - a.inUse || a.sector.localeCompare(b.sector));
}
function possessionStart(asset) {
  return asset.entregue_em || asset.atualizado_em || asset.criado_em || new Date().toISOString();
}
function possessionHours(asset) {
  const start = new Date(String(possessionStart(asset)).replace(' ', 'T'));
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, (Date.now() - start.getTime()) / 3600000);
}
function formatDurationFromHours(hours) {
  const totalMinutes = Math.max(0, Math.floor(hours * 60));
  const days = Math.floor(totalMinutes / 1440);
  const hrs = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  if (days) return `${days}d ${hrs}h`;
  if (hrs) return `${hrs}h ${mins}min`;
  return `${mins}min`;
}
function pendingAssetsRank(assets) {
  return assets.map((asset) => ({ asset, hours: possessionHours(asset) })).sort((a, b) => b.hours - a.hours);
}
function assetLeaderStats(pendingAssets) {
  const map = new Map();
  pendingAssets.forEach((asset) => {
    const leader = asset.responsavel_lider || 'Sem líder';
    const row = map.get(leader) || { leader, sector: asset.responsavel_setor || asset.observacoes || '-', total: 0, pending: 0, last: asset.atualizado_em || asset.entregue_em };
    row.total += 1;
    row.pending += 1;
    if (new Date(asset.atualizado_em || 0) > new Date(row.last || 0)) row.last = asset.atualizado_em;
    map.set(leader, row);
  });
  return [...map.values()].sort((a, b) => b.pending - a.pending || a.leader.localeCompare(b.leader));
}
function scoreLabel(value) { return value >= 90 ? 'Excelente' : value >= 75 ? 'Atenção' : 'Crítico'; }
function scoreTone(value) { return value >= 90 ? 'success' : value >= 75 ? 'warn' : 'danger'; }
function renderSmartAlerts(summary) {
  const alerts = [
    { tone: scoreTone(summary.score), text: summary.score >= 90 ? 'Operação saudável' : summary.score >= 75 ? 'Operação em atenção' : 'Operação crítica' },
    { tone: summary.pending ? 'warn' : 'success', text: `${summary.pending} ativo(s) com pendência` },
    { tone: summary.maintenance ? 'danger' : 'success', text: `${summary.maintenance} ativo(s) em manutenção` },
    { tone: summary.topSector && summary.topSector.available < Math.max(2, summary.topSector.total * 0.2) ? 'warn' : 'neutral', text: `${summary.topSector?.sector || '-'} com ${summary.topSector?.total || 0} ativo(s)` },
    { tone: summary.retired ? 'danger' : 'neutral', text: `${summary.retired} extraviado(s)/inativo(s)` },
  ];
  $('overview-alerts').innerHTML = alerts.map((alert) => `<span class="smart-alert ${alert.tone}">${escapeHtml(alert.text)}</span>`).join('');
}
function renderScoreAndHealth(summary) {
  const scoreEl = $('overview-score-value');
  const ring = $('overview-score-ring');
  scoreEl.innerHTML = `${summary.score}<span>/100</span>`;
  ring.style.setProperty('--score', `${summary.score * 3.6}deg`);
  ring.className = `score-ring ${scoreTone(summary.score)}`;
  ring.innerHTML = `<span>${summary.score}</span><small>/100</small>`;
  $('overview-health-value').textContent = `${summary.health}%`;
  $('overview-health-bar').style.width = `${summary.health}%`;
  $('overview-health-status').textContent = scoreLabel(summary.health);
  $('overview-health-status').className = `health-status ${scoreTone(summary.health)}`;
  $('overview-health-summary').textContent = `${summary.available} disponíveis, ${summary.maintenance} em manutenção e ${summary.retired} inativos.`;
}
function renderAssetTypeDistribution(summary) {
  const total = Math.max(1, summary.total);
  $('overview-type-distribution').innerHTML = summary.typeStats.map((row) => {
    const share = percentage(row.total, total);
    const use = percentage(row.inUse, row.total);
    return dashboardBar(row.type, row.total, share, `${row.available} disp. · ${row.inUse} uso · ${row.maintenance} manut.`, use);
  }).join('') || emptyMini('Nenhum ativo cadastrado.');
}
function renderSectorUtilization(summary) {
  const max = Math.max(1, ...summary.inUseSectorStats.map((row) => row.inUse));
  $('overview-sector-utilization').innerHTML = summary.inUseSectorStats.slice(0, 10).map((row) => {
    const width = Math.round((row.inUse / max) * 100);
    return dashboardBar(row.sector, row.inUse, width, `${row.employees} colaborador(es) · ${row.leaders} líder(es)`, undefined);
  }).join('') || emptyMini('Nenhum ativo em uso na operação.');
}
function dashboardBar(label, value, width, detail, rate) {
  return `<div class="dash-bar"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div><div class="dash-track"><span style="width:${Math.max(4, Math.min(100, width))}%"></span></div><b>${escapeHtml(value)}</b>${rate !== undefined ? `<em>${escapeHtml(rate)}%</em>` : ''}</div>`;
}
function renderPendingReturnsPanel(summary) {
  const rows = summary.pendingRank.slice(0, 8);
  const list = rows.map(({ asset, hours }) => {
    const employee = asset.usuario_atual_nome || asset.responsavel_nome || 'Sem colaborador';
    const leader = asset.responsavel_lider || 'Sem líder';
    const sector = asset.responsavel_setor || asset.observacoes || '-';
    return `<div class="pending-offender"><div><strong>${escapeHtml(employee)}</strong><span>${escapeHtml(asset.codigo_patrimonio)} · ${escapeHtml(asset.tipo)}</span></div><div><small>Líder</small><b>${escapeHtml(leader)}</b></div><div><small>Setor</small><b>${escapeHtml(sector)}</b></div><em>${escapeHtml(formatDurationFromHours(hours))}</em></div>`;
  }).join('');
  $('overview-pending-panel').innerHTML = `<div class="pending-summary compact"><strong>${summary.pending}</strong><span>ativos aguardando devolução</span></div><div class="pending-offenders">${list || emptyMini('Nenhuma pendência de devolução.')}</div><button class="btn ghost full" data-overview-filter="pending">Ver pendências</button>`;
}
function renderLeadershipRanking(summary) {
  const rows = summary.leaderStats.slice(0, 6);
  $('overview-leader-ranking').innerHTML = rows.map((row) => `<tr><td>${escapeHtml(row.leader)}</td><td>${escapeHtml(row.sector)}</td><td>${row.total}</td><td>${row.pending}</td><td>${statusBadge(row.pending >= 5 ? 'Baixado' : row.pending >= 2 ? 'Pendente' : 'Disponivel')}</td></tr>`).join('') || emptyRow(5, 'Nenhuma pendência por liderança.');
}
function renderUpcomingMaintenance(summary) {
  const maintenance = state.assets
    .filter((asset) => asset.status === 'Manutencao')
    .slice(0, 6);
  $('overview-maintenance-list').innerHTML = maintenance.map((asset, index) => `<div class="maintenance-item"><div class="tool-icon">?</div><div><strong>${escapeHtml(asset.tipo)} ${escapeHtml(asset.codigo_patrimonio)}</strong><span>${escapeHtml(asset.modelo || 'Ativo')} · ${escapeHtml(assetArea(asset))}</span></div><b>${index < 2 ? 'Prioritária' : 'Programada'}</b></div>`).join('') || emptyMini('Nenhuma manutenção pendente.');
}
function renderRecentAssetMovements(summary) {
  const movementRows = [
    ...state.pdaRequests.map((m) => ({ asset: m.ativo || m.serial || m.id, action: m.tipo || 'Movimentação', sector: m.setor || '-', responsible: m.colaborador || '-', date: m.criadoEm })),
    ...state.assets.slice(0, 8).map((asset) => ({ asset: asset.codigo_patrimonio, action: asset.status, sector: assetArea(asset), responsible: asset.usuario_atual_nome || asset.responsavel_nome || '-', date: asset.atualizado_em })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 7);
  $('overview-recent-movements').innerHTML = movementRows.map((row) => `<tr><td>${escapeHtml(row.asset || '-')}</td><td>${escapeHtml(row.action || '-')}</td><td>${escapeHtml(row.sector || '-')}</td><td>${escapeHtml(row.responsible || '-')}</td><td>${formatDate(row.date)}</td></tr>`).join('') || emptyRow(5, 'Nenhuma movimentação recente.');
}
function renderFinancialSummary(summary) {
  const estimatedValues = { PDA: 1800, Notebook: 3500, Radio: 650, Paleteira: 2200, Coletor: 1600, Impressora: 900, Outro: 500 };
  const valueOf = (asset) => Number(asset.valor || estimatedValues[asset.tipo] || estimatedValues.Outro);
  const total = state.assets.reduce((sum, asset) => sum + valueOf(asset), 0);
  const inUse = state.assets.filter((asset) => asset.status === 'Em Uso').reduce((sum, asset) => sum + valueOf(asset), 0);
  const available = state.assets.filter((asset) => asset.status === 'Disponivel').reduce((sum, asset) => sum + valueOf(asset), 0);
  const maintenance = state.assets.filter((asset) => asset.status === 'Manutencao').reduce((sum, asset) => sum + valueOf(asset), 0);
  const retired = state.assets.filter((asset) => asset.status === 'Baixado').reduce((sum, asset) => sum + valueOf(asset), 0);
  const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const cards = [['Valor total', total], ['Em operação', inUse], ['Parado/disponível', available], ['Em manutenção', maintenance], ['Perdido/inativo', retired]];
  $('overview-financial-summary').innerHTML = cards.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${money(value)}</strong></div>`).join('');
}
function applyOverviewQuickFilter(filter) {
  const statusMap = { available: 'Disponivel', 'in-use': 'Em Uso', maintenance: 'Manutencao', pending: 'Em Uso', retired: 'Baixado' };
  if (filter === 'pending') {
    navigate('requests');
    return;
  }
  if (statusMap[filter]) {
    state.inventoryStatus = statusMap[filter];
    $('asset-status-filter').value = statusMap[filter];
  } else {
    state.inventoryStatus = '';
    $('asset-status-filter').value = '';
  }
  navigate('inventory');
}
function renderOperationalKpiCards(summary) {
  const hasMovements = summary.movements.length > 0;
  $('overview-operational-kpis').innerHTML = [
    operationalMetric('?', 'Retiradas hoje', summary.withdrawalsToday, 'PDAs retirados na data operacional', 'info'),
    operationalMetric('?', 'Devoluções hoje', summary.returnsToday, 'PDAs devolvidos na data operacional', 'success'),
    operationalMetric('%', 'Taxa de retorno', hasMovements ? `${summary.returnRate}%` : '-', hasMovements ? 'Devolvidos dentro do prazo' : 'Sem movimentações registradas', hasMovements && summary.returnRate < 75 ? 'warn' : 'neutral'),
    operationalMetric('?', 'Média de uso por PDA', hasMovements ? `${summary.avgUse}h` : '-', hasMovements ? 'Tempo médio em operação' : 'Sem movimentações registradas', 'neutral'),
    operationalMetric('?', 'Setor com maior consumo', summary.topSector, hasMovements ? 'Maior retirada de PDAs' : 'Sem movimentações registradas', hasMovements ? 'warn' : 'neutral'),
    operationalMetric('?', 'Líder com maior pendência', summary.topLeader, hasMovements ? 'Maior volume pendente' : 'Sem pendências registradas', summary.topLeader === '-' ? 'neutral' : 'danger'),
  ].join('');
}
function operationalMetric(icon, title, value, description, tone = 'neutral') { return `<article class="metric-card op ${tone}"><div class="metric-top"><span>${escapeHtml(title)}</span>${icon ? `<div class="metric-icon">${icon}</div>` : ''}</div><b>${escapeHtml(value)}</b><small>${escapeHtml(description)}</small></article>`; }
function isNotebookAsset(asset) {
  const text = `${asset.codigo_patrimonio || ''} ${asset.tipo || ''} ${asset.modelo || ''}`.toLowerCase();
  return asset.tipo === 'Notebook' || text.includes('notebook') || text.includes('laptop') || text.includes('note');
}
function isRadioAsset(asset) {
  const text = `${asset.codigo_patrimonio || ''} ${asset.tipo || ''} ${asset.modelo || ''}`.toLowerCase();
  return asset.tipo === 'Radio' || text.includes('rádio') || text.includes('radio') || text.includes('ht') || text.includes('walkie');
}
function isPaleteiraAsset(asset) {
  const text = `${asset.codigo_patrimonio || ''} ${asset.tipo || ''} ${asset.modelo || ''}`.toLowerCase();
  return asset.tipo === 'Paleteira' || text.includes('paleteira');
}
function isOtherDashboardAsset(asset) {
  return !isPdaAsset(asset) && !isNotebookAsset(asset) && !isRadioAsset(asset) && !isPaleteiraAsset(asset);
}
function calculateAssetsBySector(predicate) {
  const map = new Map();
  state.assets.filter(predicate).forEach((asset) => {
    const sector = assetArea(asset);
    map.set(sector, (map.get(sector) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([sector, total]) => [sector, total, 'var(--orange)']);
}
function renderOverviewAssetCharts() {
  renderBarRows('overview-pda-sector-chart', calculateAssetsBySector(isPdaAsset));
  renderBarRows('overview-notebook-sector-chart', calculateAssetsBySector(isNotebookAsset));
  renderBarRows('overview-radio-sector-chart', calculateAssetsBySector(isRadioAsset));
  renderBarRows('overview-paleteira-sector-chart', calculateAssetsBySector(isPaleteiraAsset));
  renderBarRows('overview-other-sector-chart', calculateAssetsBySector(isOtherDashboardAsset));
}
function renderSectorPdaCards() {
  const stats = calculatePdasBySector();
  if (!stats.length) { $('sector-pda-cards').innerHTML = emptyMini('Nenhuma movimentação de PDA registrada.'); return; }
  const max = Math.max(1, ...stats.map((s) => s.inOperation));
  $('sector-pda-cards').innerHTML = stats.map((s) => `<div class="sector-card ${statusTone(s.status)}"><div><strong>${escapeHtml(s.sector)}</strong><span>${s.inOperation} PDAs em operação · ${s.pending} pendente(s)</span></div><div class="sector-progress"><div style="width:${Math.round(s.inOperation / max * 100)}%"></div></div><footer><span>${s.returned} devolvidos</span><b>${s.returnRate}% retorno</b><em>${s.status}</em></footer></div>`).join('');
}
function renderPendingByLeader() {
  const rows = calculatePendingReturnsByLeader();
  $('leader-pending-table').innerHTML = rows.map((r) => `<tr><td><strong>${escapeHtml(r.leaderName)}</strong></td><td>${escapeHtml(r.sector)}</td><td>${r.employeesCount}</td><td>${r.withdrawn}</td><td>${r.returned}</td><td>${r.pending}</td><td>${r.delayed}</td><td>${statusBadge(r.status === 'Em dia' ? 'Disponivel' : r.status === 'Atenção' ? 'Pendente' : 'Em atraso')}</td><td><div class="row-actions"><button class="btn secondary" data-leader-details="${escapeHtml(r.leaderName)}">Ver detalhes</button><button class="btn primary" data-notify-leader="${escapeHtml(r.leaderId)}">Cobrar liderança</button></div></td></tr>`).join('') || emptyRow(9, 'Nenhuma pendência por líder.');
}
function renderOverviewStatusChart() {
  const summary = calculateOperationalSummary();
  const rows = [['Disponível', summary.available, 'var(--green)'], ['Em operação', summary.inOperation, 'var(--blue)'], ['Pendente devolução', summary.pending, 'var(--yellow)'], ['Em atraso', summary.delayed, 'var(--red)'], ['Manutenção', summary.maintenance, 'var(--purple)']];
  renderBarRows('overview-status-chart', rows);
}
function renderSectorUsageChart() { renderBarRows('overview-sector-chart', calculatePdasBySector().slice(0, 7).map((s) => [s.sector, s.inOperation, toneColor(s.status)])); }
function renderLeaderPendingChart() { renderBarRows('overview-leader-chart', calculatePendingReturnsByLeader().slice(0, 6).map((l) => [l.leaderName, l.pending, toneColor(l.status)])); }
function renderBarRows(id, rows) { const el = $(id); if (!el) return; if (!rows.length) { el.innerHTML = emptyMini('Nenhum ativo cadastrado nesta categoria.'); return; } const max = Math.max(1, ...rows.map(([,v]) => v)); el.innerHTML = rows.map(([label,value,color]) => `<div class="chart-row"><span>${escapeHtml(label)}</span><div class="chart-track"><div class="chart-fill" style="width:${Math.round(value / max * 100)}%;background:${color}"></div></div><b>${value}</b></div>`).join(''); }
function renderWithdrawalReturnFlow() {
  const shifts = ['T1', 'T2', 'T3'];
  const movements = filteredOverviewMovements();
  $('overview-flow-chart').innerHTML = shifts.map((shift) => {
    const withdrawals = movements.filter((m) => m.shift === shift && m.type === 'Retirada').length;
    const returns = movements.filter((m) => m.shift === shift && m.status === 'Devolvido').length;
    const pending = Math.max(0, withdrawals - returns);
    const max = Math.max(1, withdrawals, returns, pending);
    return `<div class="flow-row"><strong>${shift}</strong><span class="flow-bar out" style="height:${30 + withdrawals / max * 60}px" title="Retiradas ${withdrawals}"></span><span class="flow-bar in" style="height:${30 + returns / max * 60}px" title="Devoluções ${returns}"></span><span class="flow-bar pending" style="height:${30 + pending / max * 60}px" title="Saldo pendente ${pending}"></span><small>R ${withdrawals} · D ${returns} · P ${pending}</small></div>`;
  }).join('');
}
function renderShiftRiskCards() { const rows = calculateShiftRisk(); $('shift-risk-cards').innerHTML = rows.length ? rows.map((r) => `<div class="shift-risk ${statusTone(r.status)}"><strong>${r.shift}</strong><span>Necessários: ${r.required}</span><span>Disponíveis: ${r.available}</span><b>GAP: ${r.gap >= 0 ? '+' : ''}${r.gap}</b><em>${r.status}</em></div>`).join('') : emptyMini('Sem inventário de PDAs para calcular risco por turno.'); }
function renderOperationalAlerts() {
  const alerts = buildOperationalAlerts();
  $('operational-alerts-table').innerHTML = alerts.map((a) => `<tr><td>${escapeHtml(a.type)}</td><td><span class="severity ${severityClass(a.severity)}">${escapeHtml(a.severity)}</span></td><td>${escapeHtml(a.description)}</td><td>${escapeHtml(a.owner)}</td><td>${formatDate(a.createdAt)}</td><td>${escapeHtml(a.recommendation)}</td><td><button class="btn secondary" data-alert-details="${escapeHtml(a.id)}">Ver</button></td></tr>`).join('') || emptyRow(7, 'Nenhum alerta operacional.');
}
function buildOperationalAlerts() {
  const sector = calculatePdasBySector().filter((s) => s.pending >= 3).map((s) => ({ id:`AL-${s.sector}`, type:'Setor', severity:s.pending >= 6 ? 'Crítica' : 'Alta', description:`${s.sector} está com ${s.pending} PDAs pendentes de devolução`, owner:s.sector, createdAt:new Date().toISOString(), recommendation:'Cobrar devolução antes de novas liberações' }));
  const leader = calculatePendingReturnsByLeader().filter((l) => l.pending >= 2).map((l) => ({ id:`AL-${l.leaderId}`, type:'Liderança', severity:l.pending >= 4 ? 'Crítica' : 'Alta', description:`${l.leaderName} possui ${l.employeesCount} colaboradores com PDA em aberto`, owner:l.leaderName, createdAt:new Date().toISOString(), recommendation:'Cobrar liderança direta' }));
  const shift = calculateShiftRisk().filter((r) => r.status !== 'OK').map((r) => ({ id:`AL-${r.shift}`, type:'Turno', severity:r.status === 'Crítico' ? 'Crítica' : 'Média', description:`${r.shift} possui risco de falta de ${Math.abs(Math.min(0, r.gap))} PDAs`, owner:r.shift, createdAt:new Date().toISOString(), recommendation:'Preparar reforço para o próximo turno' }));
  return [...sector, ...leader, ...shift].slice(0, 10);
}
function renderRecommendedActions() {
  const alerts = buildOperationalAlerts();
  const actions = ['Cobrar líderes com pendência crítica', 'Recolher PDAs do turno anterior', 'Priorizar devolução antes de liberar novas retiradas', 'Verificar manutenção de PDAs indisponíveis', 'Preparar reforço para o próximo turno', 'Validar pendências sem justificativa'];
  $('recommended-actions').innerHTML = alerts.length ? actions.slice(0, 6).map((a, i) => `<div class="action-item"><b>${i + 1}</b><span>${escapeHtml(a)}</span></div>`).join('') : emptyMini('Nenhuma ação recomendada no momento.');
}
function renderRecentMovements() {
  $('recent-pda-movements').innerHTML = filteredOverviewMovements().sort((a,b) => new Date(b.withdrawnAt) - new Date(a.withdrawnAt)).slice(0, 12).map((m) => `<tr><td>${new Date(m.withdrawnAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</td><td><strong>${escapeHtml(m.assetId)}</strong><br><span class="muted">${escapeHtml(m.assetName)}</span></td><td>${escapeHtml(m.employeeName)}</td><td>${escapeHtml(m.leaderName)}</td><td>${escapeHtml(m.sector)}</td><td>${escapeHtml(m.type)}</td><td>${movementStatusBadge(m.status)}</td><td><button class="btn secondary" data-pending-details="${escapeHtml(m.id)}">Detalhes</button></td></tr>`).join('') || emptyRow(8, 'Nenhuma movimentação encontrada.');
}
function movementStatusBadge(status) { const map = { 'Em operação':'in-use', 'Pendente devolução':'pending', 'Em atraso':'retired', 'Devolvido':'available', 'Manutenção':'maintenance', 'Concluído':'available' }; return `<span class="badge ${map[status] || 'pending'}">${escapeHtml(status)}</span>`; }
function openPendingDetailsModal(id) {
  const movement = getOverviewMovements().find((m) => m.id === id) || calculatePendingReturnsByLeader().find((l) => l.leaderId === id)?.movements?.[0];
  if (!movement) return showToast('erro', 'Movimentação não encontrada.');
  selectedPendingMovementId = movement.id;
  $('pending-detail-content').innerHTML = `<div class="detail-grid"><div><b>PDA</b><span>${escapeHtml(movement.assetId)} · ${escapeHtml(movement.assetName)}</span></div><div><b>Colaborador</b><span>${escapeHtml(movement.employeeName)} (${escapeHtml(movement.employeeId)})</span></div><div><b>Líder responsável</b><span>${escapeHtml(movement.leaderName)}</span></div><div><b>Setor / Turno</b><span>${escapeHtml(movement.sector)} · ${escapeHtml(movement.shift)}</span></div><div><b>Retirada</b><span>${new Date(movement.withdrawnAt).toLocaleString('pt-BR')}</span></div><div><b>Previsão de devolução</b><span>${new Date(movement.expectedReturnAt).toLocaleString('pt-BR')}</span></div><div><b>Tempo em uso</b><span>${calculateMovementAge(movement)}h</span></div><div><b>Status</b><span>${movementStatusBadge(movement.status)}</span></div><div class="span-all"><b>Observações</b><span>${escapeHtml(movement.notes || 'Sem observação')}</span></div></div>`;
  openModal('pending-detail-modal');
}
function calculateMovementAge(m) { return Math.max(0, Math.round(((new Date(m.returnedAt || new Date()) - new Date(m.withdrawnAt)) / 3600000) * 10) / 10); }
function registerPdaReturn(movementId) {
  const data = getOverviewMovements().map((m) => m.id === movementId ? { ...m, returnedAt:new Date().toISOString(), status:'Devolvido', type:'Devolução', delayHours:0 } : m);
  saveOverviewDataToStorage(data); saveAuditLog('Devolução registrada', movementId); closeModal('pending-detail-modal'); renderOverviewPage(); showToast('sucesso', 'Devolução registrada com sucesso');
}
function justifyPendingReturn(movementId, justification = 'Pendência justificada pela liderança') {
  const data = getOverviewMovements().map((m) => m.id === movementId ? { ...m, notes: justification, status:'Pendente devolução' } : m);
  saveOverviewDataToStorage(data); saveAuditLog('Pendência justificada', movementId, { justification }); renderOverviewPage(); showToast('sucesso', 'Pendência justificada');
}
function notifyLeader(leaderId) { saveAuditLog('Cobrança enviada para liderança', leaderId); showToast('sucesso', 'Cobrança enviada para liderança'); }
function refreshOverviewData() { loadOverviewData(); renderOverviewPage(); showToast('sucesso', 'Dados atualizados'); }
function applyOverviewFilters() { overviewFilters = { date:$('overview-date').value, shift:$('overview-shift').value, sector:$('overview-sector').value, unit:$('overview-unit').value.trim(), status:$('overview-status').value }; setStored(OVERVIEW_FILTERS_KEY, overviewFilters); renderOverviewPage(); }
function exportOverviewCsv() {
  const rows = [['id','pda','colaborador','lider','setor','turno','retirada','previsao','devolucao','status','atraso'], ...filteredOverviewMovements().map((m) => [m.id,m.assetId,m.employeeName,m.leaderName,m.sector,m.shift,m.withdrawnAt,m.expectedReturnAt,m.returnedAt,m.status,m.delayHours])];
  const csv = rows.map((r) => r.map((v) => `"${String(v || '').replaceAll('"','""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'visao_geral_operacional_pdas.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function statusTone(status) { return status === 'Crítico' ? 'danger' : status === 'Atenção' ? 'warn' : 'success'; }
function toneColor(status) { return status === 'Crítico' ? 'var(--red)' : status === 'Atenção' ? 'var(--yellow)' : 'var(--green)'; }
function severityClass(severity) { return severity === 'Crítica' ? 'critical' : severity === 'Alta' ? 'high' : severity === 'Média' ? 'medium' : 'low'; }
function bindOverviewEvents() {
  ['overview-date','overview-shift','overview-sector','overview-unit','overview-status'].forEach((id) => $(id)?.addEventListener('change', applyOverviewFilters));
  $('overview-refresh-btn')?.addEventListener('click', refreshOverviewData);
  $('overview-export-btn')?.addEventListener('click', exportOverviewCsv);
  $('pending-return-btn')?.addEventListener('click', () => selectedPendingMovementId && registerPdaReturn(selectedPendingMovementId));
  $('pending-justify-btn')?.addEventListener('click', () => selectedPendingMovementId && justifyPendingReturn(selectedPendingMovementId));
  $('pending-notify-btn')?.addEventListener('click', () => { const m = getOverviewMovements().find((x) => x.id === selectedPendingMovementId); if (m) notifyLeader(m.leaderId); });
  document.addEventListener('click', (event) => {
    const details = event.target.closest('[data-pending-details]'); if (details) openPendingDetailsModal(details.dataset.pendingDetails);
    const leader = event.target.closest('[data-leader-details]'); if (leader) { const row = calculatePendingReturnsByLeader().find((l) => l.leaderName === leader.dataset.leaderDetails); if (row?.movements?.[0]) openPendingDetailsModal(row.movements[0].id); }
    const notify = event.target.closest('[data-notify-leader]'); if (notify) notifyLeader(notify.dataset.notifyLeader);
    const alert = event.target.closest('[data-alert-details]'); if (alert) showToast('alerta', 'Alerta aberto para análise gerencial.');
  });
}
bindOverviewEvents();





