const API_SOLICITACOES = '/api/solicitacoes';

// Verifica token
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

// Helper com Authorization
function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${token}`;
  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}

const tbody = document.getElementById('lista-solicitacoes');
const filtroInput = document.getElementById('filtro');

let solicitacoes = [];
let modalResolve;

// elementos da NOVA SOLICITAÇÃO
const btnNovaSolicitacao = document.getElementById('btnNovaSolicitacao');
const modalSolicitacao = document.getElementById('modal-solicitacao');
const formSolicitacao = document.getElementById('form-solicitacao');

const campoSolCliente = document.getElementById('sol_cliente_id');
const campoSolTabela = document.getElementById('sol_tabela_juros_id');
const campoSolValor = document.getElementById('sol_valor_solicitado');
const campoSolParcelas = document.getElementById('sol_parcelas');
const campoSolTaxa = document.getElementById('sol_taxa_prevista');
const btnCancelarSolic = document.getElementById('btnCancelarSolicitacao'); // NOVO

// NOVO: elementos do modal de confirmação customizado
const modalConfirmacao = document.getElementById('modal-confirmacao');
const modalTitulo = document.getElementById('modal-titulo');
const modalMensagem = document.getElementById('modal-mensagem');
const modalBtnCancelar = document.getElementById('modal-btn-cancelar');
const modalBtnConfirmar = document.getElementById('modal-btn-confirmar');
const modalInputWrapper = document.getElementById('modal-input-wrapper');
const modalInputLabel = document.getElementById('modal-input-label');
const modalInputField = document.getElementById('modal-input-field');
const modalInputHint = document.getElementById('modal-input-hint');

let clientes = [];
let tabelasJuros = [];


// NOVO: modal de confirmação com suporte a input
function abrirModalConfirmacao(titulo, mensagem, opcoes = {}) {
  if (!modalConfirmacao) {
    alert(`${titulo}\n${mensagem}`);
    return Promise.resolve({ confirmado: true, valor: null });
  }

  const {
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    showInput = false,
    inputLabel = '',
    inputPlaceholder = '',
    inputHint = '',
    inputRequired = false,
    defaultValue = '',
    inputType = 'text',
    showCancel = true,
  } = opcoes;

  modalTitulo.textContent = titulo;
  modalMensagem.textContent = mensagem;
  modalBtnConfirmar.textContent = confirmText;
  modalBtnCancelar.textContent = cancelText;
  modalBtnCancelar.style.display = showCancel ? 'inline-flex' : 'none';

  modalConfirmacao.dataset.requireInput = inputRequired ? '1' : '0';

  if (showInput) {
    modalInputWrapper.classList.remove('oculto');
    modalInputLabel.textContent = inputLabel || 'Detalhe';
    modalInputField.placeholder = inputPlaceholder || '';
    modalInputField.type = inputType;
    modalInputField.value = defaultValue;
    modalInputHint.textContent = inputHint || '';
    setTimeout(() => modalInputField.focus(), 50);
  } else {
    modalInputWrapper.classList.add('oculto');
    modalInputField.value = '';
    modalInputHint.textContent = '';
  }

  modalConfirmacao.classList.remove('oculto');

  return new Promise(resolve => {
    modalResolve = resolve;
  });
}

function fecharModalConfirmacao(confirmado = false, valor = null) {
  if (!modalConfirmacao) return;

  modalConfirmacao.classList.add('oculto');
  modalBtnCancelar.style.display = 'inline-flex';
  modalInputWrapper.classList.add('oculto');
  modalInputField.value = '';
  modalInputField.classList.remove('input-erro');
  modalInputHint.textContent = '';

  if (modalResolve) {
    modalResolve({ confirmado, valor });
    modalResolve = null;
  }
}

modalBtnCancelar?.addEventListener('click', () => {
  fecharModalConfirmacao(false, null);
});

modalBtnConfirmar?.addEventListener('click', () => {
  let valorInput = null;
  const requerInput = modalConfirmacao.dataset.requireInput === '1';

  if (!modalInputWrapper.classList.contains('oculto')) {
    valorInput = modalInputField.value.trim();
    if (requerInput && !valorInput) {
      modalInputField.classList.add('input-erro');
      modalInputField.focus();
      return;
    }
  }

  fecharModalConfirmacao(true, valorInput);
});

modalInputField?.addEventListener('input', () => {
  modalInputField.classList.remove('input-erro');
});

// NOVO: helper para usar o mesmo modal como alerta customizado
async function exibirMensagem(titulo, mensagem) {
  await abrirModalConfirmacao(titulo, mensagem, {
    confirmText: 'Fechar',
    cancelText: 'Cancelar',
    showCancel: false
  });
}


async function carregarSolicitacoes() {
  try {
    const resp = await authFetch('/api/solicitacoes');
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      await exibirMensagem('Erro', 'Erro ao buscar solicitações: ' + (err.error || resp.status));
      return;
    }
    solicitacoes = await resp.json();
    renderTabela();
  } catch (err) {
    console.error('Erro ao carregar solicitações', err);
    await exibirMensagem('Erro', 'Erro ao carregar solicitações.');
  }
}

// ========= apoio para NOVA SOLICITAÇÃO =========

async function carregarClientes() {
  try {
    const resp = await authFetch('/api/clientes');
    if (!resp.ok) throw new Error('Erro ao buscar clientes');

    clientes = await resp.json();
    if (!campoSolCliente) return;

    campoSolCliente.innerHTML = '<option value="">Selecione...</option>';
    clientes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      campoSolCliente.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar clientes para solicitação:', err);
  }
}

async function carregarTabelasJuros() {
  try {
    const resp = await authFetch('/api/tabelas-juros');
    if (!resp.ok) throw new Error('Erro ao buscar tabelas de juros');

    tabelasJuros = await resp.json();
    if (!campoSolTabela) return;

    campoSolTabela.innerHTML = '<option value="">-- Selecionar --</option>';

    tabelasJuros.forEach(t => {
      if (t.ativo !== 1) return;
      const opt = document.createElement('option');
      const labelAno = t.ano_referencia ? ` (${t.ano_referencia})` : '';
      opt.value = t.id;
      opt.textContent = `${t.nome}${labelAno}`;
      campoSolTabela.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar tabelas de juros para solicitação:', err);
  }
}


function abrirModalSolicitacao() {
  if (!modalSolicitacao) return;
  formSolicitacao?.reset();
  modalSolicitacao.classList.remove('oculto');
}

function fecharModalSolicitacao() {
  if (!modalSolicitacao) return;
  modalSolicitacao.classList.add('oculto');
}

async function salvarSolicitacao(e) {
  e.preventDefault();
  if (!campoSolCliente || !campoSolValor || !campoSolParcelas) return;

  const cliente_id = Number(campoSolCliente.value);
  const valor_solicitado = Number(
    String(campoSolValor.value).replace('.', '').replace(',', '.')
  );
  const parcelas_solicitadas = Number(campoSolParcelas.value);
  const taxa_prevista = campoSolTaxa.value
    ? Number(String(campoSolTaxa.value).replace(',', '.'))
    : null;
  const tabela_juros_id = campoSolTabela.value
    ? Number(campoSolTabela.value)
    : null;

  if (!cliente_id || !valor_solicitado || !parcelas_solicitadas) {
    await exibirMensagem('Atenção', 'Informe cliente, valor e parcelas.');
    return;
  }

  try {
    const resp = await authFetch(API_SOLICITACOES, {
      method: 'POST',
      body: JSON.stringify({
        cliente_id,
        tabela_juros_id,
        valor_solicitado,
        parcelas_solicitadas,
        taxa_prevista,
        status_solicitacao: 'rascunho' // NOVO: força criação como rascunho
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Erro ao criar solicitação:', data);
      await exibirMensagem('Erro', data.error || 'Erro ao criar solicitação.');
      return;
    }

    fecharModalSolicitacao();
    await carregarSolicitacoes();
    await exibirMensagem('Tudo certo', 'Solicitação criada como rascunho.');
  } catch (err) {
    console.error('Erro ao salvar solicitação:', err);
    await exibirMensagem('Erro', 'Erro ao salvar solicitação.');
  }
}


function renderTabela() {
  const filtro = (filtroInput.value || '').toLowerCase();
  tbody.innerHTML = '';

  const filtradas = solicitacoes.filter((s) => {
    const nome = (s.nome_cliente || '').toLowerCase();
    const status = (s.status_solicitacao || '').toLowerCase();
    return nome.includes(filtro) || status.includes(filtro) || String(s.id).includes(filtro);
  });

  if (!filtradas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:16px;">Nenhuma solicitação encontrada.</td>
      </tr>`;
    return;
  }

  for (const s of filtradas) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${s.id}</td>
      <td>
      <button class="link-cliente" data-cliente-id="${s.cliente_id}">
        ${s.nome_cliente}
      </button>
      </td>
      <td>R$ ${Number(s.valor_solicitado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td>${s.parcelas_solicitadas}</td>
      <td>${formatarStatus(s.status_solicitacao)}</td>
      <td>${formatarData(s.criado_em)}</td>
      <td class="acoes"></td>
    `;

    const tdAcoes = tr.querySelector('.acoes');
    montarBotoesAcoes(tdAcoes, s);

    tbody.appendChild(tr);
  }
}

function formatarStatus(status) {
  if (!status) return '-';
  const map = {
    rascunho: 'Rascunho',
    enviado: 'Enviado',
    em_analise: 'Em análise',
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
    cancelado: 'Cancelado',
    liberado: 'Liberado',
  };
  return map[status] || status;
}

function formatarData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function montarBotoesAcoes(container, s) {
  container.innerHTML = '';

  // esses botões são "otimistas": se o perfil não tiver permissão, o backend devolve 403
  if (['rascunho', 'reprovado'].includes(s.status_solicitacao)) {
    const btnEnviar = criarBotao('Enviar p/ análise', 'btn-primario', () => enviarParaAnalise(s.id));
    container.appendChild(btnEnviar);
  }

  if (['enviado', 'em_analise'].includes(s.status_solicitacao)) {
    const btnAprovar = criarBotao('Aprovar', 'btn-sucesso', () => aprovarSolicitacao(s.id));
    const btnReprovar = criarBotao('Reprovar', 'btn-perigo', () => reprovarSolicitacao(s.id));
    container.appendChild(btnAprovar);
    container.appendChild(btnReprovar);
  }

  if (s.status_solicitacao === 'aprovado') {
    const btnLiberar = criarBotao('Liberar', 'btn-info', () => liberarSolicitacao(s.id));
    container.appendChild(btnLiberar);
  }

  if (s.status_solicitacao === 'liberado') {
    container.textContent = 'Liberado';
  }
}

function criarBotao(texto, classe, onClick) {
  const btn = document.createElement('button');
  btn.textContent = texto;
  btn.className = classe;
  btn.onclick = onClick;
  return btn;
}

// ==== ações ====

async function enviarParaAnalise(id) {
  const resposta = await abrirModalConfirmacao(
    'Enviar para análise',
    'Você confirma o envio desta solicitação para o analista?'
  );
  if (!resposta.confirmado) return;

  const resp = await authFetch(`${API_SOLICITACOES}/${id}/enviar-para-analise`, {
    method: 'POST'
  });

  await tratarRespostaAcao(resp, 'Solicitação enviada para análise.');
}

async function aprovarSolicitacao(id) {
  const resposta = await abrirModalConfirmacao(
    'Aprovar solicitação',
    'Confirma a aprovação desta solicitação?',
    { confirmText: 'Aprovar' }
  );
  if (!resposta.confirmado) return;

  const resp = await authFetch(`/api/solicitacoes/${id}/aprovar`, { method: 'POST' });
  await tratarRespostaAcao(resp, 'Solicitação aprovada.');
}

async function reprovarSolicitacao(id) {
  const { confirmado, valor } = await abrirModalConfirmacao(
    'Reprovar solicitação',
    'Deseja reprovar esta solicitação? Informe o motivo se desejar.',
    {
      confirmText: 'Reprovar',
      showInput: true,
      inputLabel: 'Motivo da reprovação',
      inputPlaceholder: 'Opcional',
      inputHint: 'Esse motivo aparecerá para o cliente/analista.'
    }
  );
  if (!confirmado) return;

  const resp = await authFetch(`/api/solicitacoes/${id}/reprovar`, {
    method: 'POST',
    body: JSON.stringify({ motivo_recusa: valor || '' }),
  });
  await tratarRespostaAcao(resp, 'Solicitação reprovada.');
}

async function liberarSolicitacao(id) {
  const { confirmado, valor } = await abrirModalConfirmacao(
    'Liberar solicitação',
    'Informe a forma de liberação.',
    {
      confirmText: 'Liberar',
      showInput: true,
      inputLabel: 'Forma de liberação',
      inputPlaceholder: 'PIX, TED, DINHEIRO...',
      inputRequired: true
    }
  );
  if (!confirmado || !valor) return;

  const resp = await authFetch(`${API_SOLICITACOES}/${id}/liberar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forma_liberacao: valor })
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    await exibirMensagem('Erro', data.error || 'Erro ao liberar solicitação.');
    return;
  }

  await exibirMensagem('Tudo certo', `Solicitação liberada.\nConta destino: ${data.conta_destino || '-'}`);
  await carregarSolicitacoes();
}


// NOVO: trata respostas sempre com o modal customizado
async function tratarRespostaAcao(resp, mensagemOk) {
  const data = await resp.json().catch(() => ({}));
  if (resp.ok) {
    await exibirMensagem('Tudo certo', mensagemOk);
    await carregarSolicitacoes();
    return;
  }

  await exibirMensagem('Erro', 'Erro: ' + (data.error || resp.status));
}

// NOVO: garante abertura do modal com dados formatados
async function abrirDetalhesCliente(clienteId) {
  try {
    // dados básicos do cliente
    const respCli = await authFetch(`/api/clientes/${clienteId}`);
    if (!respCli.ok) throw new Error('Erro ao buscar cliente');
    const cliente = await respCli.json();

    // resumo financeiro
    const respRes = await authFetch(`/api/clientes/${clienteId}/resumo-financeiro`);
    const resumo = respRes.ok ? await respRes.json() : null;

    const box = document.getElementById('cliente-detalhes');

    const renda = Number(cliente.renda_mensal || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });

    const totalAberto = Number(resumo?.total_em_aberto || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });
    const totalAtrasado = Number(resumo?.total_atrasado || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });
    const mediaAtraso = resumo?.media_dias_atraso ?? 0;

    box.innerHTML = `
      <p><strong>Nome:</strong> ${cliente.nome}</p>
      <p><strong>CPF:</strong> ${cliente.cpf_formatado || cliente.cpf}</p>
      <p><strong>Renda mensal:</strong> ${renda}</p>
      <p><strong>Situação profissional:</strong> ${cliente.situacao_profissional || '-'}</p>
      <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
      <p><strong>Empréstimos ativos:</strong> ${resumo ? resumo.qtd_emprestimos_ativos : 0}</p>
      <p><strong>Total em aberto:</strong> ${totalAberto}</p>
      <p><strong>Total em atraso:</strong> ${totalAtrasado}</p>
      <p><strong>Parcelas atrasadas:</strong> ${resumo ? resumo.parcelas_atrasadas : 0}</p>
      <p><strong>Média de dias de atraso:</strong> ${mediaAtraso ? mediaAtraso.toFixed(1) : '0,0'}</p>
    `;

    document.getElementById('modal-cliente').classList.remove('oculto');
  } catch (err) {
    console.error('Erro ao abrir detalhes do cliente:', err);
    await exibirMensagem('Erro', 'Erro ao carregar informações do cliente.');
  }
}

document.getElementById('btnFecharCliente')?.addEventListener('click', () => {
  document.getElementById('modal-cliente').classList.add('oculto');
});

tbody?.addEventListener('click', (e) => {
  const btn = e.target.closest('.link-cliente');
  if (!btn) return;
  const clienteId = btn.dataset.clienteId;
  abrirDetalhesCliente(clienteId);
});

filtroInput?.addEventListener('input', renderTabela);

// eventos do modal de nova solicitação
if (btnNovaSolicitacao) {
  btnNovaSolicitacao.addEventListener('click', abrirModalSolicitacao);
}

const btnFecharSolic = document.getElementById('btnFecharSolicitacao');
if (btnFecharSolic) {
  btnFecharSolic.addEventListener('click', fecharModalSolicitacao);
}
btnCancelarSolic?.addEventListener('click', fecharModalSolicitacao); // NOVO

if (formSolicitacao) {
  formSolicitacao.addEventListener('submit', salvarSolicitacao);
}
// inicia
(async function init() {
  await Promise.all([
    carregarClientes(),
    carregarTabelasJuros()
  ]);

  await carregarSolicitacoes();

  // NOVO: se a solicitação veio da tela de empréstimos, avisa e limpa o flag
  if (localStorage.getItem('solicitacoesNeedsRefresh')) {
    localStorage.removeItem('solicitacoesNeedsRefresh');
    await exibirMensagem('Solicitação criada', 'Incluímos uma nova solicitação a partir da tela de Empréstimos.');
  }
})();
