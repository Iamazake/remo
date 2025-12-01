// APIs iguais às outras telas
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

// ====== DOM ======
const formSimulador      = document.getElementById('form-simulador');
const campoCliente       = document.getElementById('cliente_id');
const campoTabelaJuros   = document.getElementById('tabela_juros_id');
const campoValor         = document.getElementById('valor');
const campoParcelas      = document.getElementById('parcelas');
const campoTaxa          = document.getElementById('taxa');
const campoDataInicio    = document.getElementById('data_inicio');
const campoDiaVencimento = document.getElementById('dia_vencimento');

const resultadoEl        = document.getElementById('resultado');
const campoValorParcela  = document.getElementById('valor_parcela');
const campoTotalPago     = document.getElementById('total_pago');
const campoTotalJuros    = document.getElementById('total_juros');

const tabelaParcelasEl   = document.getElementById('tabela-parcelas');
const listaParcelasEl    = document.getElementById('lista-parcelas');

const btnGerarSolicitacao = document.getElementById('btnGerarSolicitacao');

// ====== CACHES ======
let clientes = [];
let tabelasJurosCache = [];
const tabelasJurosDetalhes = {};

// ====== Util ======
function formatarBRL(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function adicionarMes(data, n) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + n);
  return d;
}

function formatarDataISO(d) {
  return d.toISOString().slice(0, 10); // yyyy-mm-dd
}

// Fórmula PMT (Price):
// PMT = P * i / (1 - (1 + i)^(-n))
function calcularPMT(valor, taxaMesPercent, parcelas) {
  const n = parcelas;
  const i = taxaMesPercent / 100;

  if (n <= 0) return 0;

  if (i === 0) {
    return valor / n;
  }

  const pmt = valor * i / (1 - Math.pow(1 + i, -n));
  return pmt;
}

// ====== Carregar clientes ======
async function carregarClientes() {
  try {
    const resp = await authFetch(API_CLIENTES);
    if (!resp.ok) throw new Error('Erro ao buscar clientes');

    clientes = await resp.json();

    campoCliente.innerHTML = '<option value="">Selecione...</option>';
    clientes.forEach(c => {
      campoCliente.insertAdjacentHTML(
        'beforeend',
        `<option value="${c.id}">${c.nome}</option>`
      );
    });
  } catch (err) {
    console.error('Erro ao carregar clientes:', err);
    alert('Erro ao carregar clientes. Verifique o backend.');
  }
}

// ====== Tabela de juros <select> ======
function preencherSelectTabelas(selectEl, tabelas) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">-- Selecionar --</option>';
  for (const t of tabelas) {
    // só mostra ativas
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
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar tabelas de juros.');
  }
}

// Detalhes: pega as faixas (parcela_de / parcela_ate / taxa)
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

// Atualiza automaticamente a taxa conforme tabela + parcelas
async function atualizarTaxaAutomaticaSimulador() {
  const tabelaId = campoTabelaJuros.value;
  const qtdParcelas = Number(campoParcelas.value || 0);

  // se não escolheu tabela, libera o campo de taxa
  if (!tabelaId) {
    campoTaxa.readOnly = false;
    campoTaxa.classList.remove('readonly');
    return;
  }

  // se não informou parcelas ainda, não faz nada
  if (!qtdParcelas) {
    return;
  }

  const tabela = await obterDetalhesTabelaJuros(tabelaId);
  if (!tabela || !Array.isArray(tabela.faixas)) {
    campoTaxa.readOnly = false;
    campoTaxa.classList.remove('readonly');
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

    campoTaxa.readOnly = false;
    campoTaxa.classList.remove('readonly');
    campoTaxa.value = '';

    alert(
      `Essa tabela de juros só está configurada até ${maxFaixa} parcelas. ` +
      `Ajuste a quantidade de parcelas ou escolha outra tabela.`
    );
    return;
  }

  campoTaxa.readOnly = true;
  campoTaxa.classList.add('readonly');
  campoTaxa.value = Number(faixa.taxa).toFixed(2);
}

// ====== Simulação PMT ======
function simularPMT(event) {
  event.preventDefault();

  const valor = Number(campoValor.value || 0);
  const parcelas = Number(campoParcelas.value || 0);
  const taxa = Number(campoTaxa.value || 0);

  if (!valor || !parcelas) {
    alert('Informe valor e quantidade de parcelas.');
    return;
  }

  const pmt = calcularPMT(valor, taxa, parcelas);
  const totalPago = pmt * parcelas;
  const totalJuros = totalPago - valor;

  campoValorParcela.textContent = formatarBRL(pmt);
  campoTotalPago.textContent = formatarBRL(totalPago);
  campoTotalJuros.textContent = formatarBRL(totalJuros);

  // chips do cabeçalho do resultado
const tagParcelas = document.getElementById('res_parcelas_tag');
const tagTaxa = document.getElementById('res_taxa_tag');

if (tagParcelas) {
  tagParcelas.textContent = `${parcelas}x`;
}
if (tagTaxa) {
  if (taxa) {
    tagTaxa.textContent = `Taxa ${taxa.toFixed(2).replace('.', ',')}% a.m.`;
  } else {
    tagTaxa.textContent = 'Taxa 0% a.m.';
  }
}


  resultadoEl.style.display = 'block';

  // Montar grade simples (aproximada)
  listaParcelasEl.innerHTML = '';

  let saldo = valor;
  const dataBase = campoDataInicio.value
    ? new Date(campoDataInicio.value)
    : new Date();

  const diaVenc = Number(campoDiaVencimento.value || 0);

  for (let n = 1; n <= parcelas; n++) {
    const jurosMes = saldo * (taxa / 100);
    const amortizacao = pmt - jurosMes;
    saldo = saldo - amortizacao;
    if (saldo < 0) saldo = 0;

    const dataParcela = adicionarMes(dataBase, n - 1);
    if (diaVenc >= 1 && diaVenc <= 31) {
      dataParcela.setDate(diaVenc);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${n}</td>
      <td>${formatarDataISO(dataParcela)}</td>
      <td>${formatarBRL(pmt)}</td>
      <td>${formatarBRL(saldo)}</td>
    `;
    listaParcelasEl.appendChild(tr);
  }

  tabelaParcelasEl.style.display = 'block';
}

// ====== Gerar solicitação a partir da simulação ======
async function gerarSolicitacao() {
  const cliente_id = campoCliente.value;
  const valor_solicitado = Number(campoValor.value || 0);
  const parcelas_solicitadas = Number(campoParcelas.value || 0);
  const tabela_juros_id = campoTabelaJuros.value || null;
  const taxa_prevista = campoTaxa.value || null;

  if (!cliente_id) {
    alert('Selecione um cliente para gerar a solicitação.');
    return;
  }
  if (!valor_solicitado || !parcelas_solicitadas) {
    alert('Informe valor e quantidade de parcelas antes de gerar a solicitação.');
    return;
  }

  try {
    const resp = await authFetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id,
        valor_solicitado,
        parcelas_solicitadas,
        tabela_juros_id,
        taxa_prevista,
        status_solicitacao: 'rascunho', // backend já deixa como rascunho por padrão
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error('Erro ao criar solicitação:', data);
      alert(data.error || 'Erro ao criar solicitação.');
      return;
    }

    alert('Solicitação criada como rascunho! Você pode ver na tela de Solicitações.');
    // se quiser, já redireciona:
    // window.location.href = '/solicitacoes/index.html';
  } catch (err) {
    console.error('Erro ao criar solicitação:', err);
    alert('Erro ao criar solicitação.');
  }
}

// ====== Eventos / Init ======
formSimulador.addEventListener('submit', simularPMT);
btnGerarSolicitacao.addEventListener('click', gerarSolicitacao);

// atualizar taxa quando mudar a tabela ou as parcelas
campoTabelaJuros.addEventListener('change', atualizarTaxaAutomaticaSimulador);
campoParcelas.addEventListener('blur', atualizarTaxaAutomaticaSimulador);

(async function init() {
  await carregarClientes();
  await carregarTabelasJuros();
})();
