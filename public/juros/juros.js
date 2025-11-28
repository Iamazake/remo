const API_TABELAS_JUROS = "/api/tabelas-juros";

// Elementos da tela
const listaEl = document.getElementById("lista-tabelas");
const btnNovo = document.getElementById("btnNovo");
const filtroInput = document.getElementById("filtro");
const btnBuscar = document.getElementById("btnBuscar");

// Modal
const modal = document.getElementById("modal");
const btnFecharModal = document.getElementById("btnFecharModal");
const btnCancelar = document.getElementById("btnCancelar");
const tituloForm = document.getElementById("titulo-form");
const form = document.getElementById("form-tabela-juros");

// Campos do formulário
const campoId = document.getElementById("id");
const campoNome = document.getElementById("nome");
const campoAno = document.getElementById("ano_referencia");
const campoAtivo = document.getElementById("ativo");
const campoDescricao = document.getElementById("descricao");
const tbodyFaixas = document.getElementById("tbody-faixas");
const btnAddFaixa = document.getElementById("btnAddFaixa");

let tabelasCache = [];
let editandoId = null;

// Helper de fetch com token
function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    throw new Error("Token não encontrado");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers });
}

// -------- Modal --------
function abrirModal(novo = true, dados = null) {
  modal.classList.remove("oculto");

  if (novo) {
    tituloForm.textContent = "Nova Tabela de Juros";
    editandoId = null;
    form.reset();
    campoAtivo.checked = true;
    tbodyFaixas.innerHTML = "";
    adicionarLinhaFaixa(); // começa com uma linha
  } else if (dados) {
    tituloForm.textContent = "Editar Tabela de Juros";
    editandoId = dados.id;

    campoId.value = dados.id;
    campoNome.value = dados.nome || "";
    campoAno.value = dados.ano_referencia || "";
    campoDescricao.value = dados.descricao || "";
    campoAtivo.checked = dados.ativo === 1;

    tbodyFaixas.innerHTML = "";
    if (Array.isArray(dados.faixas) && dados.faixas.length > 0) {
      for (const f of dados.faixas) {
        adicionarLinhaFaixa(f);
      }
    } else {
      adicionarLinhaFaixa();
    }
  }
}

function fecharModal() {
  modal.classList.add("oculto");
}

// -------- Faixas --------
function adicionarLinhaFaixa(dados = null) {
  const tr = document.createElement("tr");
  tr.classList.add("linha-faixa");

  tr.innerHTML = `
    <td><input type="number" min="1" class="inp-parcela-de" value="${dados ? dados.parcela_de : ""}"></td>
    <td><input type="number" min="1" class="inp-parcela-ate" value="${dados ? dados.parcela_ate : ""}"></td>
    <td><input type="number" step="0.01" class="inp-taxa" value="${dados ? dados.taxa : ""}"></td>
    <td>
      <button type="button" class="btn-danger btn-remover-faixa">X</button>
    </td>
  `;

  const btnRemover = tr.querySelector(".btn-remover-faixa");
  btnRemover.addEventListener("click", () => {
    tr.remove();
  });

  tbodyFaixas.appendChild(tr);
}

// -------- Listagem --------
function formataData(dataISO) {
  if (!dataISO) return "";
  const d = new Date(dataISO);
  if (isNaN(d.getTime())) return dataISO;
  return d.toLocaleDateString("pt-BR");
}

function renderTabela() {
  const filtro = (filtroInput.value || "").toLowerCase().trim();

  let lista = [...tabelasCache];

  if (filtro) {
    lista = lista.filter((t) => {
      const nome = (t.nome || "").toLowerCase();
      const ano = t.ano_referencia ? String(t.ano_referencia) : "";
      return nome.includes(filtro) || ano.includes(filtro);
    });
  }

  listaEl.innerHTML = "";

  if (lista.length === 0) {
    listaEl.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:12px;">
          Nenhuma tabela de juros encontrada.
        </td>
      </tr>
    `;
    return;
  }

  for (const t of lista) {
    const tr = document.createElement("tr");

    const badge =
      t.ativo === 1
        ? '<span class="badge-ativo">Ativa</span>'
        : '<span class="badge-inativo">Inativa</span>';

    tr.innerHTML = `
      <td>${t.id}</td>
      <td>${t.nome || ""}</td>
      <td>${t.ano_referencia || ""}</td>
      <td>${t.qtd_faixas || 0}</td>
      <td>${badge}</td>
      <td>${formataData(t.criado_em)}</td>
      <td>
        <button class="btn-secondary btn-editar" data-id="${t.id}">Editar</button>
        <button class="btn-danger btn-excluir" data-id="${t.id}">Excluir</button>
      </td>
    `;

    listaEl.appendChild(tr);
  }
}

async function carregarTabelas() {
  try {
    const resp = await authFetch(API_TABELAS_JUROS);
    if (!resp.ok) {
      throw new Error("Erro ao buscar tabelas de juros");
    }
    const data = await resp.json();
    tabelasCache = data;
    renderTabela();
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar tabelas de juros.");
  }
}

// -------- Salvar --------
function coletarFaixasDoFormulario() {
  const linhas = tbodyFaixas.querySelectorAll(".linha-faixa");
  const faixas = [];

  for (const linha of linhas) {
    const de = linha.querySelector(".inp-parcela-de").value;
    const ate = linha.querySelector(".inp-parcela-ate").value;
    const taxa = linha.querySelector(".inp-taxa").value;

    if (!de && !ate && !taxa) continue; // linha vazia

    faixas.push({
      parcela_de: de,
      parcela_ate: ate,
      taxa: taxa,
    });
  }

  return faixas;
}

async function salvarTabela(event) {
  event.preventDefault();

  const faixas = coletarFaixasDoFormulario();
  if (faixas.length === 0) {
    alert("Informe pelo menos uma faixa de parcelas.");
    return;
  }

    const maxParcela = Math.max(...faixas.map(f => Number(f.parcela_ate)));
    if (maxParcela > 120) {
    alert("A quantidade máxima de parcelas permitida é 120.");
    return;
    }

  // 🔎 validação de faixas em ordem e sem voltar para trás
const faixasOrdenadas = [...faixas].sort(
  (a, b) => Number(a.parcela_de) - Number(b.parcela_de)
);

for (let i = 0; i < faixasOrdenadas.length; i++) {
  const atual = faixasOrdenadas[i];
  const de = Number(atual.parcela_de);
  const ate = Number(atual.parcela_ate);

  if (!de || !ate || ate < de) {
    alert(
      `Confira as faixas: a parcela inicial não pode ser vazia, zero ou maior que a final.`
    );
    return;
  }

  if (i > 0) {
    const anterior = faixasOrdenadas[i - 1];
    const prevAte = Number(anterior.parcela_ate);

    // regra: a próxima faixa não pode começar menor ou igual à anterior
    if (de <= prevAte) {
      alert(
        `A faixa ${i + 1} deve começar em parcela maior que ${prevAte}. ` +
          `Ex.: se a faixa anterior vai até ${prevAte}, comece em ${
            prevAte + 1
          }.`
      );
      return;
    }
  }
}


  const payload = {
    nome: campoNome.value,
    ano_referencia: campoAno.value,
    descricao: campoDescricao.value,
    ativo: campoAtivo.checked ? 1 : 0,
    faixas,
  };

  try {
    let resp;
    if (editandoId) {
      resp = await authFetch(`${API_TABELAS_JUROS}/${editandoId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      resp = await authFetch(API_TABELAS_JUROS, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      const msg = errJson.error || "Erro ao salvar tabela de juros.";
      throw new Error(msg);
    }

    fecharModal();
    await carregarTabelas();
  } catch (err) {
    console.error(err);
    alert(err.message || "Erro ao salvar tabela de juros.");
  }
}

// -------- Ações da tabela (editar/excluir) --------
async function onClickTabela(e) {
  const btnEditar = e.target.closest(".btn-editar");
  const btnExcluir = e.target.closest(".btn-excluir");

  if (btnEditar) {
    const id = btnEditar.dataset.id;
    try {
      const resp = await authFetch(`${API_TABELAS_JUROS}/${id}`);
      if (!resp.ok) throw new Error("Erro ao buscar tabela de juros.");
      const dados = await resp.json();
      abrirModal(false, dados);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados da tabela de juros.");
    }
  }

  if (btnExcluir) {
    const id = btnExcluir.dataset.id;
    if (!confirm("Tem certeza que deseja excluir esta tabela de juros?")) {
      return;
    }
    try {
      const resp = await authFetch(`${API_TABELAS_JUROS}/${id}`, {
        method: "DELETE",
      });
      if (!resp.ok) throw new Error("Erro ao excluir tabela de juros.");
      await carregarTabelas();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir tabela de juros.");
    }
  }
}

// -------- Eventos --------
btnNovo.addEventListener("click", () => abrirModal(true));
btnFecharModal.addEventListener("click", fecharModal);
btnCancelar.addEventListener("click", fecharModal);
btnAddFaixa.addEventListener("click", () => adicionarLinhaFaixa());

form.addEventListener("submit", salvarTabela);
listaEl.addEventListener("click", onClickTabela);
btnBuscar.addEventListener("click", renderTabela);
filtroInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    renderTabela();
  }
});

// -------- Inicialização --------
carregarTabelas();
