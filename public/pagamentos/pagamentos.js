const API_PAGAMENTOS = '/api/pagamentos';

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

const listaEl = document.getElementById('lista-pagamentos');
const filtroInput = document.getElementById('filtro');
const btnBuscar = document.getElementById('btnBuscar');

const modal = document.getElementById('modal-pagamento');
const btnFecharModal = document.getElementById('btnFecharModal');
const btnCancelar = document.getElementById('btnCancelar');
const form = document.getElementById('form-pagamento');

// campos modal
const pgCliente = document.getElementById('pg_cliente');
const pgParcela = document.getElementById('pgAA_parcela');
const pgDataPrevista = document.getElementById('pg_data_prevista');
const pgDataPagamento = document.getElementById('pg_data_pagamento');
const pgValorOriginal = document.getElementById('pg_valor_original');
const pgValorPago = document.getElementById('pg_valor_pago');
const pgDiasAtraso = document.getElementById('pg_dias_atraso');
const pgValorSugerido = document.getElementById('pg_valor_sugerido');
const pgForma = document.getElementById('pg_forma');
const pgObs = document.getElementById('pg_observacoes');

let pagamentos = [];
let pagamentoSelecionado = null;
let filtroStatus = 'abertos'; // 'abertos' | 'pagos' | 'todos'

// constantes de juros (ajustáveis depois)
const MULTA_FIXA_PERCENT = 2;     // 2% de multa
const JUROS_DIA_PERCENT = 0.33;   // 0,33% ao dia

// utils
function formataValor(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formataData(d) {
  if (!d) return '-';
  const data = new Date(d);
  if (isNaN(data.getTime())) {
    return String(d).split('T')[0] || String(d);
  }
  return data.toLocaleDateString('pt-BR');
}

function badgeStatus(status) {
  const s = (status || '').toLowerCase();
  if (s === 'pago') return '<span class="badge badge-pago">Pago</span>';
  if (s === 'atrasado') return '<span class="badge badge-atrasado">Atrasado</span>';
  return '<span class="badge badge-pendente">Pendente</span>';
}

function normalizarDataDia(d) {
  const data = new Date(d);
  data.setHours(0, 0, 0, 0);
  return data;
}

// farol visual
function classeFarol(p) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataPrev = normalizarDataDia(p.data_prevista);
  const dataPag = p.data_pagamento ? normalizarDataDia(p.data_pagamento) : null;

  const diffDias = Math.floor((dataPrev - hoje) / (1000 * 60 * 60 * 24));

  if (p.status === 'pago') {
    if (dataPag && dataPag <= dataPrev) return 'farol-verde'; // pago em dia
    return 'farol-azul'; // pago com atraso
  }

  // pendente
  if (diffDias === 0 || diffDias === 1) return 'farol-amarelo'; // vence hoje/amanhã
  if (hoje > dataPrev) return 'farol-vermelho'; // atrasado

  return '';
}

// carregar pagamentos
async function carregarPagamentos() {
  try {
    const resp = await authFetch(API_PAGAMENTOS);
    if (!resp.ok) throw new Error('Erro ao buscar pagamentos');

    pagamentos = await resp.json();
    renderTabela();
  } catch (err) {
    console.error('Erro ao carregar pagamentos:', err);
    alert('Erro ao carregar pagamentos. Verifique o backend.');
  }
}

// render com agrupamento por cliente
function renderTabela() {
  const termo = (filtroInput.value || '').toLowerCase();

  // 1) filtro de texto + abas
  const filtrados = pagamentos.filter(p => {
    const nome = (p.nome_cliente || '').toLowerCase();
    const status = (p.status || '').toLowerCase();
    const forma = (p.forma_pagamento || '').toLowerCase();

    const okTexto =
      nome.includes(termo) ||
      status.includes(termo) ||
      forma.includes(termo);

    if (!okTexto) return false;

    if (filtroStatus === 'pagos') {
      return status === 'pago';
    }
    if (filtroStatus === 'abertos') {
      return status !== 'pago'; // pendente + atrasado
    }

    return true; // 'todos'
  });

  // 2) agrupar por cliente
  const grupos = new Map();

  filtrados.forEach(p => {
    const key = p.cliente_id;
    if (!grupos.has(key)) {
      grupos.set(key, {
        cliente_id: p.cliente_id,
        nome_cliente: p.nome_cliente,
        parcelas: []
      });
    }
    grupos.get(key).parcelas.push(p);
  });

  listaEl.innerHTML = '';

  if (grupos.size === 0) {
    listaEl.innerHTML = '<tr><td colspan="11">Nenhuma parcela encontrada.</td></tr>';
    return;
  }

  // 3) montar linhas
  grupos.forEach(grupo => {
    const parcelas = grupo.parcelas;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const totalDevido = parcelas
      .filter(parc => parc.status !== 'pago')
      .reduce((acc, parc) => acc + Number(parc.valor || 0), 0);

    const qtdPend = parcelas.filter(parc => parc.status !== 'pago').length;

    const qtdAtras = parcelas.filter(parc => {
      if (parc.status === 'pago') return false;
      const prev = normalizarDataDia(parc.data_prevista);
      return prev < hoje;          // vencido = atrasado
    }).length;


    let resumo = [];
    if (qtdPend > 0) resumo.push(`${qtdPend} em aberto`);
    if (qtdAtras > 0) resumo.push(`${qtdAtras} atrasada(s)`);

    // linha mestre (cliente)
    const trGrupo = document.createElement('tr');
    trGrupo.classList.add('linha-grupo');
    trGrupo.dataset.clienteId = grupo.cliente_id;

    trGrupo.innerHTML = `
      <td></td>
      <td colspan="3">
        <strong>${grupo.nome_cliente}</strong>
      </td>
      <td>${totalDevido > 0 ? formataValor(totalDevido) : '-'}</td>
      <td colspan="5">
        ${resumo.join(' • ') || 'Nenhuma pendência'}
      </td>
      <td style="text-align:right;">
        <span class="toggle-seta">▶</span>
      </td>
    `;

    listaEl.appendChild(trGrupo);

    // linhas de parcelas (filhas)
    parcelas.forEach(p => {
      const tr = document.createElement('tr');
      tr.classList.add('linha-parcela', 'oculto');
      tr.dataset.clienteId = grupo.cliente_id;

      const clsFarol = classeFarol(p);

      tr.innerHTML = `
        <td>${clsFarol ? `<span class="farol ${clsFarol}"></span>` : ''}</td>
        <td>${p.nome_cliente || '-'}</td>
        <td>#${p.emprestimo_id}</td>
        <td>${p.numero_parcela}</td>
        <td>${formataValor(p.valor)}</td>
        <td>${p.valor_pago ? formataValor(p.valor_pago) : '-'}</td>
        <td>${formataData(p.data_prevista)}</td>
        <td>${formataData(p.data_pagamento)}</td>
        <td>${badgeStatus(p.status)}</td>
        <td>${p.forma_pagamento || '-'}</td>
        <td>
          <button class="btn-acao pagar" data-id="${p.id}" ${p.status === 'pago' ? 'disabled' : ''}>
            Pagar
          </button>
        </td>
      `;

      listaEl.appendChild(tr);
    });
  });
}

// modal
function abrirModal(p) {
  pagamentoSelecionado = p;

  pgCliente.value = p.nome_cliente || '';
  pgParcela.value = `${p.numero_parcela}`;
  pgDataPrevista.value = formataData(p.data_prevista);

  const hojeISO = new Date().toISOString().split('T')[0];
  pgDataPagamento.value = hojeISO;

  pgValorOriginal.value = Number(p.valor).toFixed(2).replace('.', ',');
  pgObs.value = p.observacoes || '';
  pgForma.value = '';

  // dias de atraso + valor sugerido
  const dataPrev = normalizarDataDia(p.data_prevista);
  const hoje = normalizarDataDia(hojeISO);
  let diasAtraso = Math.floor((hoje - dataPrev) / (1000 * 60 * 60 * 24));
  if (isNaN(diasAtraso) || diasAtraso < 0) diasAtraso = 0;

  pgDiasAtraso.value = diasAtraso;

  let valorOriginal = Number(p.valor);
  let valorSugerido = valorOriginal;

  if (diasAtraso > 0) {
    const multa = (MULTA_FIXA_PERCENT / 100) * valorOriginal;
    const juros = ((JUROS_DIA_PERCENT / 100) * diasAtraso) * valorOriginal;
    valorSugerido = valorOriginal + multa + juros;
  }

  pgValorSugerido.value = valorSugerido.toFixed(2).replace('.', ',');
  pgValorPago.value = valorSugerido.toFixed(2);

  modal.classList.remove('oculto');
}

function fecharModal() {
  modal.classList.add('oculto');
  pagamentoSelecionado = null;
  form.reset();
}

// clicar na tabela - botão Pagar
listaEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.pagar');
  if (!btn) return;

  const id = btn.dataset.id;
  const p = pagamentos.find(x => String(x.id) === String(id));
  if (!p) return;

  abrirModal(p);
});

// salvar pagamento
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pagamentoSelecionado) return;

  const id = pagamentoSelecionado.id;

  const data_pagamento = pgDataPagamento.value;
  const valor_pago = pgValorPago.value;
  const forma_pagamento = pgForma.value;
  const observacoes = pgObs.value;

  if (!data_pagamento || !valor_pago || !forma_pagamento) {
    alert('Preencha data, valor pago e forma de pagamento.');
    return;
  }

  try {
    const resp = await authFetch(`${API_PAGAMENTOS}/${id}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_pagamento,
        valor_pago,
        forma_pagamento,
        observacoes
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Erro ao registrar pagamento:', data);
      alert(data.error || 'Erro ao registrar pagamento.');
      return;
    }

    fecharModal();
    await carregarPagamentos();
  } catch (err) {
    console.error('Erro ao registrar pagamento:', err);
    alert('Erro ao registrar pagamento.');
  }
});

// eventos extras
btnFecharModal.addEventListener('click', fecharModal);
btnCancelar.addEventListener('click', fecharModal);

btnBuscar.addEventListener('click', renderTabela);
filtroInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') renderTabela();
});

// abas de status
const tabsStatus = document.querySelectorAll('.tab-status');

tabsStatus.forEach(btn => {
  btn.addEventListener('click', () => {
    tabsStatus.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    filtroStatus = btn.dataset.status;
    renderTabela();
  });
});

// clique no grupo (accordion)
listaEl.addEventListener('click', (e) => {
  const linhaGrupo = e.target.closest('.linha-grupo');
  if (!linhaGrupo) return;

  const clienteId = linhaGrupo.dataset.clienteId;
  const linhas = document.querySelectorAll(
    `.linha-parcela[data-cliente-id="${clienteId}"]`
  );

  linhas.forEach(tr => tr.classList.toggle('oculto'));

  const seta = linhaGrupo.querySelector('.toggle-seta');
  if (seta) {
    seta.textContent = seta.textContent === '▶' ? '▼' : '▶';
  }
});

// init
(async function init() {
  await carregarPagamentos();
})();
