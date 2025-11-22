const API_EMPRESTIMOS = '/api/emprestimos';
const API_CLIENTES = '/api/clientes';

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

  if (novo) {
    tituloForm.textContent = 'Novo Empréstimo';
    editandoId = null;
    form.reset();
    campoStatus.value = 'ativo';
    campoCliente.disabled = false;      // pode escolher cliente
    campoCliente.value = '';
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
}
// -------- Carregar clientes --------

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

  if (filtrados.length === 0) {
    listaEl.innerHTML = '<tr><td colspan="11">Nenhum empréstimo encontrado.</td></tr>';
    return;
  }

  filtrados.forEach(e => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.nome_cliente || '-'}</td>
      <td>${formataValor(e.valor_total)}</td>
      <td>${e.parcelas}</td>
      <td>${formataValor(e.valor_parcela)}</td>
      <td>${Number(e.taxa).toFixed(2)}</td>
      <td>${badgeStatus(e.status)}</td>
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

  const payload = {
    cliente_id: campoCliente.value,
    valor_total: campoValorTotal.value,
    taxa: campoTaxa.value,
    parcelas: campoParcelas.value,
    data_inicio: campoDataInicio.value,
    dia_vencimento: campoDiaVenc.value,
    status: campoStatus.value,
    observacoes: campoObs.value,
    recalcularParcelas: true // no PUT, vai regenerar parcelas pendentes
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

// -------- Eventos --------

btnNovo.addEventListener('click', () => abrirModal(true));
btnFecharModal.addEventListener('click', fecharModal);
btnCancelar.addEventListener('click', fecharModal);
form.addEventListener('submit', salvarEmprestimo);
listaEl.addEventListener('click', onClickTabela);
btnBuscar.addEventListener('click', renderTabela);
filtroInput.addEventListener('keyup', e => {
  if (e.key === 'Enter') renderTabela();
});

// -------- Init --------

(async function init() {
  await carregarClientes();
  await carregarEmprestimos();
})();
