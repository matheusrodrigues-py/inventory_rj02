// frontend-integration-exemplo.js
// -----------------------------------------------------------------------------
// EXEMPLO de como conectar o HTML/JS que você já tem aos novos endpoints.
// Cole/adapte este trecho no seu arquivo JS atual do painel de requisições.
// -----------------------------------------------------------------------------

// Ajuste para a URL onde sua API está rodando
const API_BASE_URL = 'http://localhost:3001/api';

// Isso normalmente viria do usuário logado (sessão/JWT). Aqui, fixo para exemplo.
const USUARIO_LOGADO_ID = 1; // ex: id do gestor/supervisor aprovando as requisições

/**
 * Busca as requisições pendentes na API e renderiza na tabela/lista do HTML.
 * Chame essa função ao carregar a página e após cada aprovação/rejeição.
 */
async function carregarRequisicoesPendentes() {
  try {
    const resposta = await fetch(`${API_BASE_URL}/requisicoes/pendentes`);
    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      throw new Error(resultado.mensagem || 'Erro ao buscar requisições.');
    }

    renderizarTabelaDeRequisicoes(resultado.dados);
  } catch (erro) {
    console.error('Erro ao carregar requisições pendentes:', erro);
    exibirNotificacao('Não foi possível carregar as requisições pendentes.', 'erro');
  }
}

/**
 * Renderiza as linhas da tabela HTML com base nos dados recebidos da API.
 * Adapte os seletores (#tabela-requisicoes) para os IDs reais do seu template.
 */
function renderizarTabelaDeRequisicoes(requisicoes) {
  const corpoTabela = document.querySelector('#tabela-requisicoes tbody');
  corpoTabela.innerHTML = '';

  requisicoes.forEach((req) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${req.id}</td>
      <td>${req.usuario_nome}</td>
      <td>${req.ativo_tipo} - ${req.codigo_patrimonio}</td>
      <td>${new Date(req.solicitado_em).toLocaleString('pt-BR')}</td>
      <td>
        <button class="btn-aprovar" data-id="${req.id}">Aprovar</button>
        <button class="btn-rejeitar" data-id="${req.id}">Rejeitar</button>
      </td>
    `;
    corpoTabela.appendChild(linha);
  });

  // Reatribui os eventos de clique após renderizar (delegação simples)
  document.querySelectorAll('.btn-aprovar').forEach((botao) => {
    botao.addEventListener('click', () => aprovarRequisicao(botao.dataset.id));
  });

  document.querySelectorAll('.btn-rejeitar').forEach((botao) => {
    botao.addEventListener('click', () => rejeitarRequisicao(botao.dataset.id));
  });
}

/**
 * Chama o endpoint de aprovação. Ao concluir com sucesso, recarrega a lista
 * (a requisição aprovada sai da lista de "pendentes" automaticamente).
 */
async function aprovarRequisicao(requisicaoId) {
  const confirmar = confirm('Tem certeza que deseja APROVAR esta requisição?');
  if (!confirmar) return;

  try {
    const resposta = await fetch(`${API_BASE_URL}/requisicoes/${requisicaoId}/aprovar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprovadoPor: USUARIO_LOGADO_ID }),
    });

    const resultado = await resposta.json();

    if (!resposta.ok || !resultado.sucesso) {
      throw new Error(resultado.mensagem || 'Erro ao aprovar requisição.');
    }

    exibirNotificacao('Requisição aprovada! Ativo vinculado ao solicitante.', 'sucesso');
    await carregarRequisicoesPendentes(); // atualiza a tabela
  } catch (erro) {
    console.error('Erro ao aprovar:', erro);
    exibirNotificacao(erro.message, 'erro');
  }
}

/**
 * Chama o endpoint de rejeição, opcionalmente coletando um motivo.
 */
async function rejeitarRequisicao(requisicaoId) {
  const motivo = prompt('Motivo da rejeição (opcional):') || '';

  try {
    const resposta = await fetch(`${API_BASE_URL}/requisicoes/${requisicaoId}/rejeitar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprovadoPor: USUARIO_LOGADO_ID, motivo }),
    });

    const resultado = await resposta.json();

    if (!resposta.ok || !resultado.sucesso) {
      throw new Error(resultado.mensagem || 'Erro ao rejeitar requisição.');
    }

    exibirNotificacao('Requisição rejeitada.', 'aviso');
    await carregarRequisicoesPendentes();
  } catch (erro) {
    console.error('Erro ao rejeitar:', erro);
    exibirNotificacao(erro.message, 'erro');
  }
}

/**
 * Função simples de notificação. Substitua pelo seu componente de toast/alerta
 * já existente no template, se houver.
 */
function exibirNotificacao(mensagem, tipo = 'info') {
  console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
  alert(mensagem);
}

// Carrega a lista assim que a página abre
document.addEventListener('DOMContentLoaded', carregarRequisicoesPendentes);
