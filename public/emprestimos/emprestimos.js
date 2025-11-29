const API_EMPRESTIMOS = '/api/emprestimos';
const API_CLIENTES = '/api/clientes';
const API_TABELAS_JUROS = '/api/tabelas-juros';

const token = localStorage.getItem('token');


// se não tiver token, volta pro login
if (!token) {
  window.location.href = '/login.html';
}

// helper pra sempre mandar Authorization
function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

const listaEl = document.getElementById('lista-emprestimos');
const btnNovo = document.getElementById('btnNovo');
const modal = document.getElementById('modal');
const btnFecharModal = document.getElementById('btnFecharModal');
const btnCancelar = document.getElementById('btnCancelar');
const form = document.getElementById('form-emprestimo');
const tituloForm = document.getElementById('titulo-form');
const filtroInput = document.getElementById('filtro');
const btnBuscar = document.getElementById('btnBuscar');

// NOVO: modal simplificado de solicitação
const modalNovaSolic = document.getElementById('modal-nova-solicitacao');
const formNovaSolic = document.getElementById('form-nova-solicitacao');
const btnFecharNovaSolic = document.getElementById('btnFecharNovaSolic');
const btnCancelarNovaSolic = document.getElementById('btnCancelarNovaSolic');
const campoNovaSolCliente = document.getElementById('nova_sol_cliente_id');
const campoNovaSolValor = document.getElementById('nova_sol_valor');
const campoNovaSolParcelas = document.getElementById('nova_sol_parcelas');
const campoNovaSolTabela = document.getElementById('nova_sol_tabela_id');

// Campos do formulário
const campoId = document.getElementById('id');
const campoCliente = document.getElementById('cliente_id');
const campoValorTotal = document.getElementById('valor_total');
const campoTaxa = document.getElementById('taxa');
const campoParcelas = document.getElementById('parcelas');
const campoDataInicio = document.getElementById('data_inicio');
const campoDiaVenc = document.getElementById('dia_vencimento');
const campoStatus = document.getElementById('status');
const campoObs = document.getElementById('observacoes');
const campoTabelaJuros = document.getElementById('tabela_juros_id');

let tabelasJurosCache = [];      // para lista simples
const tabelasJurosDetalhes = {}; // para guardar faixas por ID

let emprestimos = [];
let clientes = [];
let editandoId = null;

// -------- Utilidades --------

function formataValor(valor) {
  if (valor == null) return '';
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formataData(dataISO) {
  if (!dataISO) return '';
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) return dataISO.split('T')[0] || dataISO;
  return data.toLocaleDateString('pt-BR');
}

function badgeStatus(status) {
  if (!status) return '';
  const s = status.toLowerCase();

  if (s === 'ativo') return '<span class="badge badge-ativo">Ativo</span>';
  if (s === 'finalizado') return '<span class="badge badge-finalizado">Finalizado</span>';
  if (s === 'atrasado') return '<span class="badge badge-atrasado">Atrasado</span>';
  if (s === 'cancelado') return '<span class="badge badge-cancelado">Cancelado</span>';

  return status;
}

// -------- Modal --------

function abrirModal(novo = true, dados = null) {
  modal.classList.remove('oculto');

    carregarTabelasJuros();

  if (novo) {
    tituloForm.textContent = 'Novo Empréstimo';
    editandoId = null;
    form.reset();
    campoStatus.value = 'ativo';
    campoCliente.disabled = false;
    campoCliente.value = '';
    campoTabelaJuros.value = '';
    campoTaxa.value = '';
  } else {
    tituloForm.textContent = 'Editar Empréstimo';
    editandoId = dados.id;
    preencherFormulario(dados);
    campoCliente.disabled = true;       // trava cliente na edição
  }
}

function fecharModal() {
  modal.classList.add('oculto');
}

function preencherFormulario(d) {
  campoId.value = d.id;
  campoCliente.value = d.cliente_id;    // como agora o select tem as opções, vai aparecer certinho
  campoValorTotal.value = d.valor_total;
  campoTaxa.value = d.taxa;
  campoParcelas.value = d.parcelas;

  if (d.data_inicio) {
    campoDataInicio.value = d.data_inicio.split('T')[0];
  }

  campoDiaVenc.value = d.dia_vencimento;
  campoStatus.value = d.status || 'ativo';
  campoObs.value = d.observacoes || '';

    // 👇 NOVO
  campoTabelaJuros.value = d.tabela_juros_id || '';
  atualizarTaxaAutomatica(); // mantém o comportamento (trava taxa se tiver tabela)
}
// -------- Carregar clientes --------

async function carregarClientes() {
  try {
    const resp = await authFetch(API_CLIENTES);
    if (!resp.ok) throw new Error('Erro ao buscar clientes');
    clientes = await resp.json();

    campoCliente.innerHTML = '<option value="">Selecione...</option>';
    if (campoNovaSolCliente) {
      campoNovaSolCliente.innerHTML = '<option value="">Selecione...</option>'; // NOVO
    }

    clientes.forEach(c => {
      campoCliente.insertAdjacentHTML(
        'beforeend',
        `<option value="${c.id}">${c.nome}</option>`
      );
      if (campoNovaSolCliente) {
        campoNovaSolCliente.insertAdjacentHTML(
          'beforeend',
          `<option value="${c.id}">${c.nome}</option>` // NOVO
        );
      }
    });
  } catch (err) {
    console.error('Erro ao carregar clientes:', err);
    alert('Erro ao carregar clientes. Verifique o backend.');
  }
}

// -------- Carregar empréstimos --------

async function carregarEmprestimos() {
  try {
    const resp = await authFetch(API_EMPRESTIMOS);
    if (!resp.ok) throw new Error('Erro ao buscar empréstimos');
    emprestimos = await resp.json();
    renderTabela();
  } catch (err) {
    console.error('Erro ao carregar empréstimos:', err);
    alert('Erro ao carregar empréstimos.');
  }
}

function renderTabela() {
  const termo = (filtroInput.value || '').toLowerCase();

  const filtrados = emprestimos.filter(e => {
    const nome = (e.nome_cliente || '').toLowerCase();
    const status = (e.status || '').toLowerCase();
    return nome.includes(termo) || status.includes(termo);
  });

  listaEl.innerHTML = '';

  // cabeçalho tem 12 colunas → colspan 12
  if (filtrados.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 12;
    td.textContent = 'Nenhum empréstimo encontrado.';
    tr.appendChild(td);
    listaEl.appendChild(tr);
    return;
  }

  filtrados.forEach(e => {
    const tr = document.createElement('tr');              // 👈 AGORA CRIA A LINHA
    const nomeTabela = e.nome_tabela_juros || '-';
    const taxaFmt = Number(e.taxa).toFixed(2) + '%';
    const statusHtml = badgeStatus(e.status);             // 👈 passa o status

    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.nome_cliente}</td>
      <td>${formataValor(e.valor_total)}</td>             <!-- usa suas funções -->
      <td>${e.parcelas}</td>
      <td>${formataValor(e.valor_parcela)}</td>
      <td>${taxaFmt}</td>
      <td>${nomeTabela}</td>
      <td>${statusHtml}</td>
      <td>${formataData(e.data_inicio)}</td>
      <td>${e.dia_vencimento}</td>
      <td>${formataData(e.data_fim)}</td>
      <td>
        <button class="btn-acao editar" data-id="${e.id}">Editar</button>
        <button class="btn-acao excluir" data-id="${e.id}">Excluir</button>
      </td>
    `;

    listaEl.appendChild(tr);
  });
}


// -------- Salvar (Criar / Atualizar) --------

async function salvarEmprestimo(event) {
  event.preventDefault();

  // se escolheu tabela de juros, precisa ter taxa preenchida
  if (campoTabelaJuros.value && !campoTaxa.value) {
    alert('Selecione uma quantidade de parcelas que exista na tabela de juros escolhida.');
    return;
  }

const payload = {
  cliente_id: campoCliente.value,
  valor_total: campoValorTotal.value,
  taxa: campoTaxa.value,
  parcelas: campoParcelas.value,
  data_inicio: campoDataInicio.value,
  dia_vencimento: campoDiaVenc.value,
  status: campoStatus.value,
  observacoes: campoObs.value,
  tabela_juros_id: campoTabelaJuros.value || null,   // 👈 NOVO
  recalcularParcelas: true
};


  const metodo = editandoId ? 'PUT' : 'POST';
  const url = editandoId ? `${API_EMPRESTIMOS}/${editandoId}` : API_EMPRESTIMOS;

  try {
      const resp = await authFetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });


    const data = await resp.json();

    if (!resp.ok) {
      console.error('Erro ao salvar empréstimo:', data);
      alert(data.error || 'Erro ao salvar empréstimo.');
      return;
    }

    await carregarEmprestimos();
    fecharModal();
  } catch (err) {
    console.error('Erro ao salvar empréstimo:', err);
    alert('Erro ao salvar empréstimo.');
  }
}

// -------- Editar / Excluir (delegação) --------

async function onClickTabela(event) {
  const btn = event.target;

  if (btn.classList.contains('editar')) {
    const id = btn.dataset.id;
    const emprestimo = emprestimos.find(e => String(e.id) === String(id));
    if (!emprestimo) return;
    abrirModal(false, emprestimo);
  }

  if (btn.classList.contains('excluir')) {
    const id = btn.dataset.id;
    if (!confirm('Tem certeza que deseja excluir este empréstimo?')) return;

    try {
      const resp = await authFetch(`${API_EMPRESTIMOS}/${id}`, {
        method: 'DELETE'
      });


      const data = await resp.json();

      if (!resp.ok) {
        console.error('Erro ao excluir empréstimo:', data);
        alert(data.error || 'Erro ao excluir empréstimo.');
        return;
      }

      await carregarEmprestimos();
    } catch (err) {
      console.error('Erro ao excluir empréstimo:', err);
      alert('Erro ao excluir empréstimo.');
    }
  }
}
// -------- Recomendação de empréstimo --------

async function carregarRecomendacaoCliente() {
  const info = document.getElementById('recomendacao-texto');
  if (!info) return; // segurança

  const clienteId = campoCliente.value;

  info.textContent = '';

  if (!clienteId) return;

  try {
    const resp = await authFetch(`${API_EMPRESTIMOS}/recomendacao/${clienteId}`);

    if (!resp.ok) {
      throw new Error('Falha ao buscar recomendação');
    }

    const data = await resp.json();

    const valor = Number(data.valor_recomendado || 0);
    const parcela = Number(data.parcela_maxima || 0);

    if (valor > 0 && parcela > 0) {
      // preenche o campo de valor total com a sugestão
      campoValorTotal.value = valor;

      const valorFmt = Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      const parcelaFmt = Number(parcela).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      info.textContent = `Sugestão de crédito: ${valorFmt} (parcela máxima: ${parcelaFmt}/mês).`;
    } else {
      info.textContent = 'Sem recomendação automática para esse cliente.';
    }

  } catch (err) {
    console.error(err);
    info.textContent = 'Não foi possível carregar a recomendação.';
  }
}

// -------- Tabela de juros <select> --------
function preencherSelectTabelas(selectEl, tabelas) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">-- Selecionar --</option>';
  for (const t of tabelas) {
    if (t.ativo !== 1) continue;
    const opt = document.createElement('option');
    const labelAno = t.ano_referencia ? ` (${t.ano_referencia})` : '';
    opt.value = t.id;
    opt.textContent = `${t.nome}${labelAno}`;
    selectEl.appendChild(opt);
  }
}

async function carregarTabelasJuros() {
  try {
    const resp = await authFetch(API_TABELAS_JUROS);
    if (!resp.ok) throw new Error('Erro ao buscar tabelas de juros');

    const data = await resp.json();
    tabelasJurosCache = data;

    preencherSelectTabelas(campoTabelaJuros, tabelasJurosCache);
    preencherSelectTabelas(campoNovaSolTabela, tabelasJurosCache); // NOVO
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar tabelas de juros.');
  }
}
// -------- Tabela de juros detalhes(faixa) --------
async function obterDetalhesTabelaJuros(id) {
  if (!id) return null;

  if (tabelasJurosDetalhes[id]) {
    return tabelasJurosDetalhes[id];
  }

  try {
    const resp = await authFetch(`${API_TABELAS_JUROS}/${id}`);
    if (!resp.ok) throw new Error('Erro ao buscar detalhes da tabela de juros');

    const dados = await resp.json();
    tabelasJurosDetalhes[id] = dados;
    return dados;
  } catch (err) {
    console.error(err);
    return null;
  }
}
// -------- Tabela de juros atualiza(auto) --------
async function atualizarTaxaAutomatica() {
  const tabelaId = campoTabelaJuros.value;
  const qtdParcelas = Number(campoParcelas.value);

  // se não escolheu tabela, libera o campo de taxa
  if (!tabelaId) {
    campoTaxa.readOnly = false;
    campoTaxa.classList.remove("readonly");
    // taxa continua o que o usuário digitar
    return;
  }

  // com tabela escolhida -> taxa sempre vem da tabela
  campoTaxa.readOnly = true;
  campoTaxa.classList.add("readonly");

  if (!qtdParcelas) {
    campoTaxa.value = "";
    return;
  }

  const tabela = await obterDetalhesTabelaJuros(tabelaId);
  if (!tabela || !Array.isArray(tabela.faixas)) {
    campoTaxa.value = "";
    alert("Tabela de juros sem faixas cadastradas.");
    return;
  }

  const faixa = tabela.faixas.find(f =>
    qtdParcelas >= Number(f.parcela_de) &&
    qtdParcelas <= Number(f.parcela_ate)
  );

  if (!faixa) {
    const maxFaixa = tabela.faixas.reduce(
      (max, f) => Math.max(max, Number(f.parcela_ate)),
      0
    );

    campoTaxa.value = "";
    alert(
      `Essa tabela de juros só está configurada até ${maxFaixa} parcelas. ` +
      `Ajuste a quantidade de parcelas ou escolha outra tabela.`
    );
    return;
  }

  campoTaxa.value = Number(faixa.taxa).toFixed(2);
}



// -------- NOVO: Modal de solicitação rápida --------

function abrirModalNovaSolicitacao() {
  formNovaSolic?.reset();
  modalNovaSolic?.classList.remove('oculto');
}

function fecharModalNovaSolicitacao() {
  modalNovaSolic?.classList.add('oculto');
}

async function salvarNovaSolicitacao(event) {
  event.preventDefault();
  const clienteId = Number(campoNovaSolCliente?.value);
  const valor = Number(campoNovaSolValor?.value);
  const parcelas = Number(campoNovaSolParcelas?.value);
  const tabelaId = campoNovaSolTabela?.value ? Number(campoNovaSolTabela.value) : null;

  if (!clienteId || !valor || !parcelas) {
    alert('Informe cliente, valor e parcelas da solicitação.');
    return;
  }

  try {
    const resp = await authFetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: clienteId,
        valor_solicitado: valor,
        parcelas_solicitadas: parcelas,
        tabela_juros_id: tabelaId,
        status_solicitacao: 'rascunho'
      })
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      alert(data.error || 'Erro ao criar solicitação.');
      return;
    }

    localStorage.setItem('solicitacoesNeedsRefresh', '1'); // NOVO
    fecharModalNovaSolicitacao();
    alert('Solicitação criada como rascunho! Confira na tela de Solicitações.');
  } catch (err) {
    console.error('Erro ao criar solicitação:', err);
    alert('Erro ao criar solicitação.');
  }
}

// -------- Eventos --------

btnNovo.addEventListener('click', (event) => {
  event.preventDefault();
  abrirModalNovaSolicitacao();
});
btnFecharModal.addEventListener('click', fecharModal);
btnCancelar.addEventListener('click', fecharModal);
form.addEventListener('submit', salvarEmprestimo);
listaEl.addEventListener('click', onClickTabela);
btnBuscar.addEventListener('click', renderTabela);
filtroInput.addEventListener('keyup', e => {
  if (e.key === 'Enter') renderTabela();
});
campoCliente.addEventListener('change', carregarRecomendacaoCliente);
campoTabelaJuros.addEventListener('change', atualizarTaxaAutomatica);
campoParcelas.addEventListener('change', atualizarTaxaAutomatica);
campoParcelas.addEventListener('blur', atualizarTaxaAutomatica);

btnFecharNovaSolic?.addEventListener('click', fecharModalNovaSolicitacao); // NOVO
btnCancelarNovaSolic?.addEventListener('click', fecharModalNovaSolicitacao); // NOVO
formNovaSolic?.addEventListener('submit', salvarNovaSolicitacao); // NOVO

// -------- Init --------

(async function init() {
  await carregarClientes();
  await carregarEmprestimos();
  await carregarTabelasJuros(); // 👈 garante tabelas carregadas na tela
})();


// =======================================================
// NOVA SOLICITAÇÃO A PARTIR DA TELA DE EMPRÉSTIMOS
// (usa os mesmos clientes e tabelas já carregados)
// =======================================================

const modalSolic = document.getElementById('modal-solicitacao');
const formSolic = document.getElementById('form-solicitacao');

const campoSolicCliente   = document.getElementById('sol_cliente_id');
const campoSolicValor     = document.getElementById('sol_valor_solicitado');
const campoSolicParcelas  = document.getElementById('sol_parcelas_solicitadas');
const campoSolicTabela    = document.getElementById('sol_tabela_juros_id');
const campoSolicTaxa      = document.getElementById('sol_taxa_prevista');

const btnNovaSolicitacao  = document.getElementById('btnNovaSolicitacao');
const btnSolicCancelar    = document.getElementById('btnSolicCancelar');

// Abre modal preenchendo combos com os dados já carregados na tela
function abrirModalNovaSolicitacao() {
  if (!modalSolic) return;

  // clientes já estão em `clientes` (carregados no init())
  campoSolicCliente.innerHTML = '<option value="">Selecione...</option>';
  clientes.forEach(c => {
    campoSolicCliente.insertAdjacentHTML(
      'beforeend',
      `<option value="${c.id}">${c.nome}</option>`
    );
  });

  // tabelas já estão em `tabelasJurosCache`
  campoSolicTabela.innerHTML = '<option value="">-- Selecionar --</option>';
  (tabelasJurosCache || [])
    .filter(t => t.ativo === 1)
    .forEach(t => {
      const labelAno = t.ano_referencia ? ` (${t.ano_referencia})` : '';
      campoSolicTabela.insertAdjacentHTML(
        'beforeend',
        `<option value="${t.id}">${t.nome}${labelAno}</option>`
      );
    });

  // limpa campos
  formSolic.reset();
  campoSolicTaxa.value = '';

  modalSolic.classList.remove('oculto');
}

function fecharModalNovaSolicitacao() {
  if (!modalSolic) return;
  modalSolic.classList.add('oculto');
}

// Calcula a taxa prevista com base na tabela de juros + qtd parcelas
async function atualizarTaxaPrevistaSolicitacao() {
  const tabelaId = campoSolicTabela.value;
  const qtdParcelas = Number(campoSolicParcelas.value);

  if (!tabelaId || !qtdParcelas) {
    campoSolicTaxa.value = '';
    return;
  }

  const tabela = await obterDetalhesTabelaJuros(tabelaId);
  if (!tabela || !Array.isArray(tabela.faixas)) {
    campoSolicTaxa.value = '';
    return;
  }

  const faixa = tabela.faixas.find(f =>
    qtdParcelas >= Number(f.parcela_de) &&
    qtdParcelas <= Number(f.parcela_ate)
  );

  campoSolicTaxa.value = faixa ? Number(faixa.taxa).toFixed(2) : '';
}

// Envia POST /api/solicitacoes com status rascunho
async function salvarSolicitacao(event) {
  event.preventDefault();

  const cliente_id = campoSolicCliente.value;
  const valorBruto = campoSolicValor.value.replace(/\./g, '').replace(',', '.');
  const valor_solicitado = Number(valorBruto || 0);
  const parcelas_solicitadas = Number(campoSolicParcelas.value || 0);
  const tabela_juros_id = campoSolicTabela.value || null;
  const taxa_prevista = campoSolicTaxa.value || null;

  if (!cliente_id || !valor_solicitado || !parcelas_solicitadas) {
    alert('Preencha cliente, valor e quantidade de parcelas.');
    return;
  }

  try {
    const resp = await authFetch('/api/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        cliente_id,
        valor_solicitado,
        parcelas_solicitadas,
        tabela_juros_id,
        taxa_prevista,
        status_solicitacao: 'rascunho'
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Erro ao criar solicitação:', data);
      alert(data.error || 'Erro ao criar solicitação.');
      return;
    }

    // só pra saber, na tela de Solicitações, que veio daqui
    localStorage.setItem('solicitacao_criada_de_emprestimos', '1');

    fecharModalNovaSolicitacao();

    // se quiser, pode redirecionar direto:
    // window.location.href = '/solicitacoes/index.html';

  } catch (err) {
    console.error('Erro ao criar solicitação:', err);
    alert('Erro ao criar solicitação.');
  }
}

// Eventos
if (btnNovaSolicitacao) {
  btnNovaSolicitacao.addEventListener('click', abrirModalNovaSolicitacao);
}
if (btnSolicCancelar) {
  btnSolicCancelar.addEventListener('click', fecharModalNovaSolicitacao);
}
if (formSolic) {
  formSolic.addEventListener('submit', salvarSolicitacao);
}
if (campoSolicTabela && campoSolicParcelas) {
  campoSolicTabela.addEventListener('change', atualizarTaxaPrevistaSolicitacao);
  campoSolicParcelas.addEventListener('blur', atualizarTaxaPrevistaSolicitacao);
}
