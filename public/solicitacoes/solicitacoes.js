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

const campoSolCliente  = document.getElementById('sol_cliente_id');
const campoSolTabela   = document.getElementById('sol_tabela_id');
const campoSolValor    = document.getElementById('sol_valor');
const campoSolParcelas = document.getElementById('sol_parcelas');
const campoSolTaxa     = document.getElementById('sol_taxa_prevista');
const btnCancelarSolic = document.getElementById('btnCancelarSolic');


// NOVO: elementos do modal de confirmação customizado
const modalConfirmacao = document.getElementById('modal-confirmacao');
const modalTitulo = document.getElementById('modal-titulo');
const modalMensagem = document.getElementById('modal-mensagem');
const modalBtnCancelar = document.getElementById('modal-btn-cancelar');
const modalBtnConfirmar = document.getElementById('modal-btn-confirmar');
const modalInputWrapper = document.getElementById('modal-extra-field');
const modalInputLabel   = document.getElementById('modal-extra-label');
const modalInputField   = document.getElementById('modal-extra-input');
const modalInputHint    = document.getElementById('modal-extra-hint');


let clientes = [];
let tabelasJuros = [];


// ===== helpers de juros (simulação da solicitação) =====
function calcularParcelaPrice(valor, taxaPercent, qtdParcelas) {
  const n = Number(qtdParcelas);
  const i = Number(taxaPercent) / 100;

  if (!n || n <= 0) return 0;

  if (!i) {
    return Math.round((valor / n) * 100) / 100;
  }

  const parcela = (i * valor) / (1 - Math.pow(1 + i, -n));
  return Math.round(parcela * 100) / 100;
}

function encontrarTabelaPorId(id) {
  return tabelasJuros.find(t => Number(t.id) === Number(id)) || null;
}

function obterTaxaDaSolicitacao(solic) {
  const parcelas = Number(solic.parcelas_solicitadas || 0);
  const tabela = solic.tabela_juros_id ? encontrarTabelaPorId(solic.tabela_juros_id) : null;

  if (tabela && Array.isArray(tabela.faixas)) {
    const faixa = tabela.faixas.find(f =>
      parcelas >= Number(f.parcela_de) &&
      parcelas <= Number(f.parcela_ate)
    );
    if (faixa) {
      return { taxa: Number(faixa.taxa), tabela };
    }
  }

  if (solic.taxa_prevista != null) {
    return { taxa: Number(solic.taxa_prevista), tabela };
  }

  return { taxa: null, tabela };
}

function formatCurrencyBR(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function calcularIdade(dataStr) {
  if (!dataStr) return null;
  const dt = new Date(dataStr);
  if (Number.isNaN(dt.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - dt.getFullYear();
  const m = hoje.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dt.getDate())) {
    idade--;
  }
  return idade;
}

function formatarMeses(meses) {
  if (!meses || meses <= 0) return 'menos de 1 mês';
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  const partes = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (restoMeses > 0) partes.push(`${restoMeses} mês${restoMeses > 1 ? 'es' : ''}`);
  return partes.join(' e ');
}

function formatarTempoRelacao(dataStr) {
  if (!dataStr) return '-';
  const inicio = new Date(dataStr);
  if (Number.isNaN(inicio.getTime())) return '-';
  const hoje = new Date();
  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  if (anos <= 0 && meses <= 0) return 'menos de 1 mês';
  const partes = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (meses > 0) partes.push(`${meses} mês${meses > 1 ? 'es' : ''}`);
  return partes.join(' e ');
}


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
    if (modalInputHint) modalInputHint.textContent = inputHint || '';
    setTimeout(() => modalInputField.focus(), 50);
  } else {
    modalInputWrapper.classList.add('oculto');
    modalInputField.value = '';
    if (modalInputHint) modalInputHint.textContent = '';
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
  if (modalInputHint) modalInputHint.textContent = '';


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
  // taxa passa a ser sempre calculada na aprovação
  const taxa_prevista = null;
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
        <button
          class="link-cliente"
          data-cliente-id="${s.cliente_id}"
          data-solicitacao-id="${s.id}"
        >
          ${s.nome_cliente}
        </button>
      </td>
      <td>R$ ${Number(s.valor_solicitado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td>${s.parcelas_solicitadas}</td>
      <td>
        <span class="status-pill status-${s.status_solicitacao}">
          ${formatarStatus(s.status_solicitacao)}
        </span>
      </td>
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
function classeStatus(status) {
  if (!status) return 'status-rascunho';
  const map = {
    rascunho: 'status-rascunho',
    enviado: 'status-enviado',
    em_analise: 'status-em_analise',
    aprovado: 'status-aprovado',
    reprovado: 'status-reprovado',
    cancelado: 'status-reprovado',
    liberado: 'status-liberado',
  };
  return map[status] || 'status-rascunho';
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
async function abrirDetalhesSolicitacao(clienteId, solicitacao) {
  try {
    // 1) busca paralela dos dados do cliente
    const [respCli, respResumo, respRenda, respEmp] = await Promise.all([
      authFetch(`/api/clientes/${clienteId}`),
      authFetch(`/api/clientes/${clienteId}/resumo-financeiro`),
      authFetch(`/api/clientes/${clienteId}/renda`),
      authFetch(`/api/clientes/${clienteId}/empregos`)
    ]);

    if (!respCli.ok) throw new Error('Erro ao buscar cliente');
    const cliente = await respCli.json();
    const resumo = respResumo.ok ? await respResumo.json() : null;
    const rendaInfo = respRenda.ok ? await respRenda.json() : null;
    const empregos = respEmp.ok ? await respEmp.json() : [];
    const emprego = empregos.length ? empregos[0] : null;

    // ===== Cliente / demografia =====
    const idade = calcularIdade(cliente.data_nascimento);
    const cidadeUf = [cliente.cidade, cliente.estado].filter(Boolean).join(' / ');
    const dependentes = cliente.numero_dependentes != null ? cliente.numero_dependentes : '-';
    const tempoResidencia = formatarMeses(cliente.tempo_residencia_meses);
    const tempoRelacao = formatarTempoRelacao(cliente.data_cadastro);

    // ===== Renda / margem =====
    const salarioBruto = rendaInfo
      ? Number(rendaInfo.salario_bruto || 0)
      : Number(cliente.renda_mensal || 0);

    const descontosEmp = rendaInfo ? Number(rendaInfo.descontos_emprestimos || 0) : 0;

    const salarioLiquido = rendaInfo
      ? Number(rendaInfo.salario_liquido || 0)
      : (salarioBruto - descontosEmp);

    const margemDisponivel = rendaInfo ? Number(rendaInfo.margem_disponivel || 0) : null;

    const totalAberto   = formatCurrencyBR(resumo?.total_em_aberto || 0);
    const totalAtrasado = formatCurrencyBR(resumo?.total_atrasado || 0);
    const mediaAtraso   = resumo?.media_dias_atraso ?? 0;

    const rendaCadastroLabel = formatCurrencyBR(cliente.renda_mensal || 0);
    const salarioBrutoLabel  = formatCurrencyBR(salarioBruto);
    const salarioLiqLabel    = formatCurrencyBR(salarioLiquido);
    const margemLabel        = margemDisponivel != null ? formatCurrencyBR(margemDisponivel) : '-';

    // ===== Coluna "Cliente" =====
    const boxCliente = document.getElementById('cliente-detalhes');

    boxCliente.innerHTML = `
      <h3>Cliente</h3>
      <p><strong>Nome:</strong> ${cliente.nome}</p>
      <p><strong>CPF:</strong> ${cliente.cpf_formatado || cliente.cpf}</p>
      <p><strong>Idade:</strong> ${idade != null ? idade + ' anos' : '-'}</p>
      <p><strong>Cidade/UF:</strong> ${cidadeUf || '-'}</p>
      <p><strong>Estado civil:</strong> ${cliente.estado_civil || '-'}</p>
      <p><strong>Dependentes:</strong> ${dependentes}</p>
      <p><strong>Tipo de residência:</strong> ${cliente.tipo_residencia || '-'}</p>
      <p><strong>Tempo de residência:</strong> ${tempoResidencia}</p>
      <p><strong>Tempo de relacionamento:</strong> ${tempoRelacao}</p>

      <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">

      <h4>Renda & histórico</h4>
      <p><strong>Renda (cadastro):</strong> ${rendaCadastroLabel}</p>
      ${rendaInfo ? `
        <p><strong>Salário bruto:</strong> ${salarioBrutoLabel}</p>
        <p><strong>Descontos com empréstimos:</strong> ${formatCurrencyBR(descontosEmp)}</p>
        <p><strong>Salário líquido:</strong> ${salarioLiqLabel}</p>
        <p><strong>Margem disponível:</strong> ${margemLabel}</p>
      ` : ''}

      <p><strong>Empréstimos ativos:</strong> ${resumo ? resumo.qtd_emprestimos_ativos : 0}</p>
      <p><strong>Total em aberto:</strong> ${totalAberto}</p>
      <p><strong>Total em atraso:</strong> ${totalAtrasado}</p>
      <p><strong>Parcelas atrasadas:</strong> ${resumo ? resumo.parcelas_atrasadas : 0}</p>
      <p><strong>Média de dias de atraso:</strong> ${mediaAtraso ? mediaAtraso.toFixed(1) : '0,0'}</p>

      <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">

      <h4>Emprego / fonte de renda</h4>
      ${
        emprego
          ? `
            <p><strong>Empresa:</strong> ${emprego.empresa}</p>
            <p><strong>Cargo:</strong> ${emprego.cargo || '-'}</p>
            <p><strong>Natureza da ocupação:</strong> ${emprego.natureza_ocupacao}</p>
            <p><strong>Tempo de empresa:</strong> ${formatarMeses(emprego.tempo_empresa_meses)}</p>
            <p><strong>Tipo de comprovante:</strong> ${emprego.tipo_comprovante || '-'}</p>
          `
          : '<p>Nenhum vínculo profissional cadastrado.</p>'
      }
    `;

    // ===== Coluna "Condições da solicitação" =====
    const boxSolic = document.getElementById('solicitacao-detalhes');
    const valorSolic   = Number(solicitacao.valor_solicitado || 0);
    const parcelas     = Number(solicitacao.parcelas_solicitadas || 0);

    const { taxa, tabela } = obterTaxaDaSolicitacao(solicitacao);

    let valorParcela = null;
    let totalPago    = null;

    if (taxa != null && parcelas && valorSolic) {
      valorParcela = calcularParcelaPrice(valorSolic, taxa, parcelas);
      totalPago    = valorParcela * parcelas;
    }

    const tabelaLabel = tabela
      ? `${tabela.nome}${tabela.ano_referencia ? ' (' + tabela.ano_referencia + ')' : ''}`
      : (solicitacao.tabela_juros_id ? `ID ${solicitacao.tabela_juros_id}` : '-');

    const taxaLabel = taxa != null
      ? `${taxa.toFixed(2).replace('.', ',')}% ao mês`
      : '- (definida na aprovação)';

    // comprometimento de renda / margem
    let percRenda = null;
    let percMargem = null;
    if (valorParcela != null && salarioLiquido > 0) {
      percRenda = (valorParcela / salarioLiquido) * 100;
    }
    if (valorParcela != null && margemDisponivel > 0) {
      percMargem = (valorParcela / margemDisponivel) * 100;
    }

    // flags simples de risco
    const riskFlags = [];
    if (percRenda != null) {
      if (percRenda > 40) {
        riskFlags.push('🔴 Alta taxa de comprometimento da renda (> 40%)');
      } else if (percRenda > 30) {
        riskFlags.push('🟠 Comprometimento de renda moderado (30% a 40%)');
      } else {
        riskFlags.push('🟢 Comprometimento de renda confortável (< 30%)');
      }
    }

    if (resumo?.parcelas_atrasadas > 0) {
      riskFlags.push(`🟠 Possui ${resumo.parcelas_atrasadas} parcela(s) em atraso`);
    }
    if (resumo?.total_atrasado > 0) {
      riskFlags.push('🟠 Existe saldo em atraso em contratos anteriores');
    }
    if (resumo?.media_dias_atraso && resumo.media_dias_atraso > 15) {
      riskFlags.push(`🔴 Média de dias de atraso alta (${resumo.media_dias_atraso.toFixed(1)} dias)`);
    }

    boxSolic.innerHTML = `
      <h3>Condições da solicitação</h3>
      <p><strong>Valor solicitado:</strong> ${formatCurrencyBR(valorSolic)}</p>
      <p><strong>Quantidade de parcelas:</strong> ${parcelas || '-'}</p>
      <p><strong>Tabela de juros:</strong> ${tabelaLabel}</p>
      <p><strong>Taxa estimada:</strong> ${taxaLabel}</p>
      <p><strong>Parcela estimada:</strong> ${
        valorParcela != null ? formatCurrencyBR(valorParcela) : '-'
      }</p>
      <p><strong>Total aproximado:</strong> ${
        totalPago != null ? formatCurrencyBR(totalPago) : '-'
      }</p>

      ${
        percRenda != null || percMargem != null
          ? `
            <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
            <h4>Comprometimento</h4>
            ${
              percRenda != null
                ? `<p><strong>Parcela / renda líquida:</strong> ${percRenda.toFixed(1)}%</p>`
                : ''
            }
            ${
              percMargem != null
                ? `<p><strong>Parcela / margem disponível:</strong> ${percMargem.toFixed(1)}%</p>`
                : ''
            }
          `
          : ''
      }

      <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">

      <h4>Alertas automáticos</h4>
      ${
        riskFlags.length
          ? `<ul class="lista-alertas">
              ${riskFlags.map(f => `<li>${f}</li>`).join('')}
             </ul>`
          : '<p>Nenhum alerta relevante.</p>'
      }
    `;

    document.getElementById('modal-cliente').classList.remove('oculto');
  } catch (err) {
    console.error('Erro ao abrir detalhes da solicitação/cliente:', err);
    alert('Erro ao carregar detalhes da solicitação.');
  }
}


document.getElementById('btnFecharCliente')?.addEventListener('click', () => {
  document.getElementById('modal-cliente').classList.add('oculto');
});

tbody?.addEventListener('click', (e) => {
  const btn = e.target.closest('.link-cliente');
  if (!btn) return;
  const clienteId     = Number(btn.dataset.clienteId);
  const solicitacaoId = Number(btn.dataset.solicitacaoId);
  const solicitacao   = solicitacoes.find(s => Number(s.id) === solicitacaoId);

  if (!clienteId || !solicitacao) return;

  abrirDetalhesSolicitacao(clienteId, solicitacao);
});

filtroInput?.addEventListener('input', renderTabela);

// eventos do modal de nova solicitação
btnNovaSolicitacao?.addEventListener('click', abrirModalSolicitacao);
const btnFecharSolic = document.getElementById('btnFecharSolic');
btnFecharSolic?.addEventListener('click', fecharModalSolicitacao);
btnCancelarSolic?.addEventListener('click', fecharModalSolicitacao);


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
