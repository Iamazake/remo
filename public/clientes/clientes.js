const API_CLIENTES = "http://localhost:3000/api/clientes";
const API_DOMINIOS = "http://localhost:3000/api/dominios";
const API_TELEFONES = "http://localhost:3000/api/telefones";
const API_EMPREGO = "http://localhost:3000/api/empregos";
const API_CONTAS = "http://localhost:3000/api/contas";

const DOMINIOS_POR_SELECT = [
  { id: "situacao_profissional", tipo: "dom_situacao_profissional" },
  { id: "tipo_residencia", tipo: "dom_tipo_residencia" },
  { id: "genero", tipo: "dom_genero" },
  { id: "estado_civil", tipo: "dom_estado_civil" },
  { id: "escolaridade", tipo: "dom_escolaridade" },
  { id: "emp_natureza", tipo: "dom_natureza_ocupacao" },
  { id: "emp_tipo_comprovante", tipo: "dom_tipo_comprovante" },
    { id: "estado", tipo: "dom_uf" },          // UF do endereço
  { id: "rg_uf", tipo: "dom_uf" },           // UF do RG
  { id: "nacionalidade", tipo: "dom_nacionalidade" },
];

const DOMINIOS_LISTAS = [
  "dom_tipo_telefone",
  "dom_tipo_conta_bancaria",
  "dom_banco",              // <--- ADICIONA ISSO
];

let listaClientes = [];
let dominiosCache = {};
let telefonesState = [];
let telefonesRemovidos = [];
let contasState = [];
let contasRemovidas = [];
let empregoAtualId = null;
let empregoRemovidoId = null;
let rendaState = null;
let stepAtual = 1;
const TOTAL_STEPS = 6;

// Campos do passo 1 (Dados pessoais)
const campoNome = document.getElementById("nome");
const campoCPF = document.getElementById("cpf");
const campoDataNasc = document.getElementById("data_nascimento");
const campoTelefone = document.getElementById("telefone");
const campoSituacaoProf = document.getElementById("situacao_profissional");
const campoRendaMensal = document.getElementById("renda_mensal");
const erroCPFSpan = document.getElementById("erro-cpf");

function limparErrosPasso1() {
  [
    campoNome,
    campoCPF,
    campoDataNasc,
    campoTelefone,
    campoSituacaoProf,
    campoRendaMensal,
  ].forEach((campo) => campo && campo.classList.remove("campo-erro"));

  if (erroCPFSpan) erroCPFSpan.textContent = "";
}

function validarPasso1() {
  limparErrosPasso1();
  let ok = true;

  // Nome
  if (!campoNome.value.trim()) {
    campoNome.classList.add("campo-erro");
    ok = false;
  }

  // CPF
  const cpfValor = campoCPF.value.trim();
  if (!cpfValor || !validarCPF(cpfValor)) {
    campoCPF.classList.add("campo-erro");
    if (erroCPFSpan) {
      erroCPFSpan.textContent = cpfValor ? "CPF inválido." : "Informe o CPF.";
    }
    ok = false;
  }

  // Data de nascimento
  if (!campoDataNasc.value) {
    campoDataNasc.classList.add("campo-erro");
    ok = false;
  }

  // Telefone
  if (!campoTelefone.value.trim()) {
    campoTelefone.classList.add("campo-erro");
    ok = false;
  }

  // Situação profissional
  if (!campoSituacaoProf.value) {
    campoSituacaoProf.classList.add("campo-erro");
    ok = false;
  }

  // Renda mensal > 0
  const rendaVal = campoRendaMensal.value;
  if (!rendaVal || Number(rendaVal) <= 0) {
    campoRendaMensal.classList.add("campo-erro");
    ok = false;
  }

  if (!ok) {
    alert("Preencha corretamente os campos obrigatórios do passo Dados pessoais.");
  }

  return ok;
}


function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    throw new Error("Token não encontrado");
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers });
}

function validarCPF(cpf) {
  cpf = String(cpf).replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.charAt(10));
}

function formatarRenda(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = Number(valor);
  if (isNaN(numero)) return valor;
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatarDataCurta(dataISO) {
  if (!dataISO) return "";
  const str = String(dataISO);
  const parteData = str.split("T")[0].split(" ")[0];
  const [ano, mes, dia] = parteData.split("-");
  if (!ano || !mes || !dia) return str;
  return `${dia}/${mes}/${ano}`;
}

function calcularStatusCliente(c) {
  const total = Number(c.total_emprestimos ?? 0);
  const ativos = Number(c.emprestimos_ativos ?? 0);
  const parcelasAtrasadas = Number(c.parcelas_atrasadas ?? 0);

  // nunca teve empréstimo
  if (total === 0) {
    return { label: "Novo", nivel: "low" };
  }

  // tem parcela atrasada
  if (parcelasAtrasadas > 0) {
    return { label: "Inadimplente", nivel: "high" };
  }

  // tem empréstimo ativo sem atraso
  if (ativos > 0) {
    return { label: "Com empréstimo ativo", nivel: "medium" };
  }

  // já teve, tudo pago
  return { label: "Em dia", nivel: "low" };
}

function renderStatusCliente(c) {
  const info = calcularStatusCliente(c);
  return `
    <span class="badge-cliente badge-${info.nivel}">
      <span class="dot-risk dot-${info.nivel}"></span>
      ${info.label}
    </span>
  `;
}

function renderSituacaoProfissional(situacao) {
  if (!situacao) return "";
  return `<span class="tag-situacao">${situacao}</span>`;
}

function renderResumoEmprestimos(c) {
  const total = Number(c.total_emprestimos || 0);
  const ativos = Number(c.emprestimos_ativos || 0);
  const atrasadas = Number(c.parcelas_atrasadas || 0);

  // Nunca teve empréstimo
  if (total === 0) {
    return '<span class="txt-emprestimos">Nenhum registro</span>';
  }

  const partes = [];

  partes.push(`${total} registro${total > 1 ? "s" : ""}`);

  if (ativos > 0) {
    partes.push(`${ativos} ativo${ativos > 1 ? "s" : ""}`);
  }

  if (atrasadas > 0) {
    partes.push(
      `${atrasadas} parcela${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`
    );
  }

  return `<span class="txt-emprestimos">${partes.join(" • ")}</span>`;
}



async function carregarClientes() {
  try {
    const resposta = await authFetch(API_CLIENTES);
    if (!resposta.ok) throw new Error("Falha ao carregar clientes");
    listaClientes = await resposta.json();
    montarTabela(listaClientes);
  } catch (err) {
    console.error(err);
    alert("Não foi possível carregar a lista de clientes.");
  }
}

function montarTabela(clientes) {
  const tbody = document.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  clientes.forEach((c) => {
    tbody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${c.id}</td>
        <td>
          <a href="/clientes/detalhe.html?id=${c.id}" class="link-cliente">
            ${c.nome || ""}
          </a>
        </td>
        <td>${c.cpf || ""}</td>
        <td>${c.telefone_principal || c.telefone || ""}</td>
        <td>${formatarRenda(c.renda_mensal)}</td>
        <td>${renderSituacaoProfissional(c.situacao_profissional)}</td>
        <td>${renderStatusCliente(c)}</td>
        <td>${formatarDataCurta(c.data_cadastro)}</td>
        <td>${renderResumoEmprestimos(c)}</td>
        <td class="col-acoes">
          <button type="button" class="btn-acao btn-acao-edit" data-id="${c.id}" title="Editar">✏️</button>
          <button type="button" class="btn-acao btn-acao-delete" data-id="${c.id}" title="Excluir">🗑️</button>
        </td>
      </tr>
      `
    );
  });
}

document.addEventListener("click", (e) => {
  const edit = e.target.closest(".btn-acao-edit");
  const del  = e.target.closest(".btn-acao-delete");
  if (edit) editar(edit.dataset.id);
  if (del)  excluir(del.dataset.id);
});


function aplicarFiltroClientes() {
  const termo = (document.getElementById("filtroCliente")?.value || "").toLowerCase();
  if (!termo) {
    montarTabela(listaClientes);
    return;
  }
  const filtrados = listaClientes.filter(cliente => {
    return (
      cliente.nome?.toLowerCase().includes(termo) ||
      cliente.cpf?.includes(termo) ||
      cliente.telefone?.includes(termo)
    );
  });
  montarTabela(filtrados);
}

async function carregarDominios() {
  try {
    const tipos = [
      ...new Set([
        ...DOMINIOS_POR_SELECT.map(item => item.tipo),
        ...DOMINIOS_LISTAS,
      ]),
    ];
    const respostas = await Promise.all(
      tipos.map(tipo => authFetch(`${API_DOMINIOS}/${tipo}`))
    );
    for (let i = 0; i < tipos.length; i++) {
      if (!respostas[i].ok) throw new Error(`Falha ao carregar domínio ${tipos[i]}`);
      dominiosCache[tipos[i]] = await respostas[i].json();
    }
    DOMINIOS_POR_SELECT.forEach(({ id, tipo }) => preencherSelect(id, tipo));
  } catch (err) {
    console.error("Erro ao carregar domínios:", err);
    alert("Não foi possível carregar as listas de apoio.");
  }
}

function getDominio(tipo) {
  return dominiosCache[tipo] || [];
}

function gerarOptionsDominio(tipo, selecionado = "", incluirPlaceholder = true) {
  const lista = getDominio(tipo);
  const placeholder = incluirPlaceholder ? `<option value="">Selecione...</option>` : "";
  const options = lista
    .map(item => {
      const selected = item.valor === selecionado ? "selected" : "";
      return `<option value="${item.valor}" ${selected}>${item.descricao}</option>`;
    })
    .join("");
  return placeholder + options;
}

function preencherSelect(id, tipoDominio) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = gerarOptionsDominio(tipoDominio, select.value);
}

function atualizarStepsUI() {
  document.querySelectorAll(".form-step").forEach(step => {
    step.classList.toggle("active", Number(step.dataset.step) === stepAtual);
  });
  document.querySelectorAll(".step-btn").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.step) === stepAtual);
  });

  const btnVoltar = document.getElementById("btnVoltarStep");
  const btnProximo = document.getElementById("btnProximoStep");
  const btnSalvar = document.getElementById("btnSalvarCliente");

  if (!btnVoltar || !btnProximo || !btnSalvar) return;

  btnVoltar.style.visibility = stepAtual === 1 ? "hidden" : "visible";
  if (stepAtual === TOTAL_STEPS) {
    btnProximo.style.display = "none";
    btnSalvar.style.display = "inline-block";
  } else {
    btnProximo.style.display = "inline-block";
    btnSalvar.style.display = "none";
  }
}

function irParaStep(novoStep) {
  if (novoStep < 1 || novoStep > TOTAL_STEPS) return;

  // se estiver saindo do passo 1 para qualquer passo > 1, valida
  if (stepAtual === 1 && novoStep > 1) {
    if (!validarPasso1()) return;
  }

  stepAtual = novoStep;
  atualizarStepsUI();
}

function resetEstadosComplementares() {
  telefonesState = [];
  telefonesRemovidos = [];
  contasState = [];
  contasRemovidas = [];
  empregoAtualId = null;
  empregoRemovidoId = null;
  rendaState = null;
  inicializarTelefones([]);
  inicializarContas([]);
  limparEmpregoForm();
  preencherRenda(null);
}

function abrirFormulario() {
  const form = document.getElementById("form-cliente");
  form.reset();
  document.getElementById("id").value = "";
  stepAtual = 1;
  resetEstadosComplementares();
  atualizarStepsUI();
  document.getElementById("modal").style.display = "flex";
}

function fecharFormulario() {
  document.getElementById("modal").style.display = "none";
}

function preencherFormularioCliente(c) {
  document.getElementById("id").value = c.id;
  document.getElementById("nome").value = c.nome || "";
  document.getElementById("cpf").value = c.cpf || "";
  document.getElementById("rg").value = c.rg || "";
  document.getElementById("data_nascimento").value = c.data_nascimento
    ? String(c.data_nascimento).split("T")[0]
    : "";
  document.getElementById("telefone").value = c.telefone || "";
  document.getElementById("situacao_profissional").value = c.situacao_profissional || "";
  document.getElementById("renda_mensal").value = c.renda_mensal || "";
  document.getElementById("observacoes").value = c.observacoes || "";

  document.getElementById("endereco").value = c.endereco || "";
  document.getElementById("numero").value = c.numero || "";
  document.getElementById("complemento").value = c.complemento || "";
  document.getElementById("bairro").value = c.bairro || "";
  document.getElementById("cidade").value = c.cidade || "";
  document.getElementById("estado").value = c.estado || "";
  document.getElementById("cep").value = c.cep || "";
  document.getElementById("tipo_residencia").value = c.tipo_residencia || "";
  document.getElementById("tempo_residencia").value = c.tempo_residencia_meses || "";

  document.getElementById("genero").value = c.genero || "";
  document.getElementById("estado_civil").value = c.estado_civil || "";
  document.getElementById("escolaridade").value = c.escolaridade || "";
  document.getElementById("numero_dependentes").value = c.numero_dependentes || "";
  document.getElementById("nacionalidade").value = c.nacionalidade || "";
  document.getElementById("rg_orgao_emissor").value = c.rg_orgao_emissor || "";
  document.getElementById("rg_uf").value = c.rg_uf || "";
  document.getElementById("rg_data_expedicao").value = c.rg_data_expedicao
    ? String(c.rg_data_expedicao).split("T")[0]
    : "";
  document.getElementById("nome_pai").value = c.nome_pai || "";
  document.getElementById("nome_mae").value = c.nome_mae || "";
}

function coletarDadosCliente() {
  return {
    nome: document.getElementById("nome").value,
    cpf: document.getElementById("cpf").value,
    rg: document.getElementById("rg").value,
    data_nascimento: document.getElementById("data_nascimento").value,
    telefone: document.getElementById("telefone").value,
    situacao_profissional: document.getElementById("situacao_profissional").value,
    renda_mensal: document.getElementById("renda_mensal").value,
    observacoes: document.getElementById("observacoes").value,
    endereco: document.getElementById("endereco").value,
    numero: document.getElementById("numero").value,
    complemento: document.getElementById("complemento").value,
    bairro: document.getElementById("bairro").value,
    cidade: document.getElementById("cidade").value,
    estado: document.getElementById("estado").value,
    cep: document.getElementById("cep").value,
    tipo_residencia: document.getElementById("tipo_residencia").value,
    tempo_residencia_meses: document.getElementById("tempo_residencia").value,
    genero: document.getElementById("genero").value,
    estado_civil: document.getElementById("estado_civil").value,
    escolaridade: document.getElementById("escolaridade").value,
    numero_dependentes: document.getElementById("numero_dependentes").value,
    nacionalidade: document.getElementById("nacionalidade").value,
    rg_orgao_emissor: document.getElementById("rg_orgao_emissor").value,
    rg_uf: document.getElementById("rg_uf").value,
    rg_data_expedicao: document.getElementById("rg_data_expedicao").value,
    nome_pai: document.getElementById("nome_pai").value,
    nome_mae: document.getElementById("nome_mae").value,
  };
}

function inicializarTelefones(lista) {
  telefonesState = (lista || []).map(item => ({ ...item }));
  if (!telefonesState.length) {
    telefonesState.push({ tipo: "", ddd: "", numero: "", contato: "" });
  }
  renderTelefones();
}

function renderTelefones() {
  const container = document.getElementById("telefonesLista");
  if (!container) return;
  container.innerHTML = telefonesState
    .map((tel, index) => {
      return `
        <div class="dynamic-row telefone-row" data-index="${index}">
          <div class="form-field">
            <label>Tipo</label>
            <select data-field="tipo">
              ${gerarOptionsDominio("dom_tipo_telefone", tel.tipo)}
            </select>
          </div>
          <div class="form-field">
            <label>DDD</label>
            <input data-field="ddd" value="${tel.ddd || ""}" maxlength="3">
          </div>
          <div class="form-field">
            <label>Número</label>
            <input data-field="numero" value="${tel.numero || ""}">
          </div>
          <div class="form-field">
            <label>Contato</label>
            <input data-field="contato" value="${tel.contato || ""}">
          </div>
          <div class="row-actions">
            <button type="button" class="btn-secondary" data-remove="${index}">🗑 Remover</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function adicionarTelefone() {
  telefonesState.push({ tipo: "", ddd: "", numero: "", contato: "" });
  renderTelefones();
}

function removerTelefone(index) {
  const telefone = telefonesState[index];
  if (telefone?.id) telefonesRemovidos.push(telefone.id);
  telefonesState.splice(index, 1);
  if (!telefonesState.length) telefonesState.push({ tipo: "", ddd: "", numero: "", contato: "" });
  renderTelefones();
}

function inicializarContas(lista) {
  contasState = (lista || []).map(item => ({ ...item, principal: Boolean(item.principal) }));
  if (!contasState.length) {
    contasState.push({ banco: "", agencia: "", conta: "", digito: "", tipo_conta: "", principal: false });
  }
  renderContas();
}

function renderContas() {
  const container = document.getElementById("contasLista");
  if (!container) return;
  container.innerHTML = contasState
    .map((conta, index) => {
      return `
        <div class="dynamic-row conta-row" data-index="${index}">
          <div class="form-field">
            <label>Banco</label>
            <select data-field="banco">
              ${gerarOptionsDominio("dom_banco", conta.banco)}
            </select>
          </div>
          <div class="form-field">
            <label>Agência</label>
            <input data-field="agencia" value="${conta.agencia || ""}">
          </div>
          <div class="form-field">
            <label>Conta</label>
            <input data-field="conta" value="${conta.conta || ""}">
          </div>
          <div class="form-field">
            <label>Dígito</label>
            <input data-field="digito" value="${conta.digito || ""}">
          </div>
          <div class="form-field">
            <label>Tipo</label>
            <select data-field="tipo_conta">
              ${gerarOptionsDominio("dom_tipo_conta_bancaria", conta.tipo_conta)}
            </select>
          </div>
          <div class="form-field">
            <label>Principal</label>
            <input type="radio" name="conta-principal" data-principal="${index}" ${conta.principal ? "checked" : ""}>
          </div>
          <div class="row-actions">
            <button type="button" class="btn-secondary" data-remove-conta="${index}">🗑 Remover</button>
          </div>
        </div>
      `;
    })
    .join("");
}


function adicionarConta() {
  contasState.push({ banco: "", agencia: "", conta: "", digito: "", tipo_conta: "", principal: false });
  renderContas();
}

function removerConta(index) {
  const conta = contasState[index];
  if (conta?.id) contasRemovidas.push(conta.id);
  contasState.splice(index, 1);
  if (!contasState.length) contasState.push({ banco: "", agencia: "", conta: "", digito: "", tipo_conta: "", principal: false });
  renderContas();
}

function limparEmpregoForm() {
  empregoAtualId = null;
  empregoRemovidoId = null;
  document.getElementById("emp_empresa").value = "";
  document.getElementById("emp_cargo").value = "";
  document.getElementById("emp_natureza").value = "";
  document.getElementById("emp_tempo").value = "";
  document.getElementById("emp_tipo_comprovante").value = "";
  document.getElementById("emp_telefone").value = "";
  document.getElementById("emp_ramal").value = "";
  document.getElementById("emp_endereco").value = "";
}

function preencherEmpregoForm(emprego) {
  if (!emprego) {
    limparEmpregoForm();
    return;
  }
  empregoAtualId = emprego.id;
  document.getElementById("emp_empresa").value = emprego.empresa || "";
  document.getElementById("emp_cargo").value = emprego.cargo || "";
  document.getElementById("emp_natureza").value = emprego.natureza_ocupacao || "";
  document.getElementById("emp_tempo").value = emprego.tempo_empresa_meses || "";
  document.getElementById("emp_tipo_comprovante").value = emprego.tipo_comprovante || "";
  document.getElementById("emp_telefone").value = emprego.telefone_comercial || "";
  document.getElementById("emp_ramal").value = emprego.ramal || "";
  document.getElementById("emp_endereco").value = emprego.endereco_empresa || "";
}

function coletarEmpregoPayload() {
  return {
    empresa: document.getElementById("emp_empresa").value,
    cargo: document.getElementById("emp_cargo").value,
    natureza_ocupacao: document.getElementById("emp_natureza").value,
    tempo_empresa_meses: document.getElementById("emp_tempo").value,
    tipo_comprovante: document.getElementById("emp_tipo_comprovante").value,
    telefone_comercial: document.getElementById("emp_telefone").value,
    ramal: document.getElementById("emp_ramal").value,
    endereco_empresa: document.getElementById("emp_endereco").value,
  };
}

function preencherRenda(dados) {
  rendaState = dados;
  document.getElementById("renda_salario_bruto").value = dados?.salario_bruto || "";
  document.getElementById("renda_descontos").value = dados?.descontos_emprestimos || "";
  atualizarResumoRenda();
}

function atualizarResumoRenda() {
  const bruto = Number(document.getElementById("renda_salario_bruto").value) || 0;
  const descontos = Number(document.getElementById("renda_descontos").value) || 0;
  const liquido = bruto - descontos;
  const margem = Math.max(0, bruto * 0.3 - descontos);
  document.getElementById("renda_salario_liquido").innerText = formatarRenda(liquido);
  document.getElementById("renda_margem").innerText = formatarRenda(margem);
}

function coletarRendaPayload() {
  const bruto = document.getElementById("renda_salario_bruto").value;
  const descontos = document.getElementById("renda_descontos").value;
  if (!bruto) return null;
  return {
    salario_bruto: bruto,
    descontos_emprestimos: descontos || 0,
  };
}

async function editar(id) {
  try {
    const [
      clienteResp,
      telefonesResp,
      empregoResp,
      rendaResp,
      contasResp,
    ] = await Promise.all([
      authFetch(`${API_CLIENTES}/${id}`),
      authFetch(`${API_CLIENTES}/${id}/telefones`),
      authFetch(`${API_CLIENTES}/${id}/empregos`),
      authFetch(`${API_CLIENTES}/${id}/renda`),
      authFetch(`${API_CLIENTES}/${id}/contas`),
    ]);

    if (!clienteResp.ok) throw new Error("Falha ao carregar cliente.");

    const cliente = await clienteResp.json();
    const telefones = telefonesResp.ok ? await telefonesResp.json() : [];
    const empregos = empregoResp.ok ? await empregoResp.json() : [];
    const renda = rendaResp.ok ? await rendaResp.json() : null;
    const contas = contasResp.ok ? await contasResp.json() : [];

    abrirFormulario();
    preencherFormularioCliente(cliente);
    inicializarTelefones(telefones);
    inicializarContas(contas);
    preencherEmpregoForm(empregos[0]);
    preencherRenda(renda);
  } catch (err) {
    console.error(err);
    alert("Não foi possível carregar os dados do cliente.");
  }
}

async function excluir(id) {
  if (!confirm("Deseja excluir este cliente?")) return;
  try {
    const resp = await authFetch(`${API_CLIENTES}/${id}`, { method: "DELETE" });
    if (!resp.ok) throw new Error("Falha ao excluir");
    carregarClientes();
  } catch (err) {
    console.error(err);
    alert("Não foi possível excluir o cliente.");
  }
}

async function sincronizarTelefones(clienteId) {
  const requisicoes = [];
  telefonesRemovidos.forEach(id => {
    requisicoes.push(authFetch(`${API_TELEFONES}/${id}`, { method: "DELETE" }));
  });
  telefonesRemovidos = [];

  telefonesState.forEach(tel => {
    if (!tel.tipo || !tel.ddd || !tel.numero) return;
    const payload = {
      tipo: tel.tipo,
      ddd: tel.ddd,
      numero: tel.numero,
      contato: tel.contato,
    };
    if (tel.id) {
      requisicoes.push(
        authFetch(`${API_TELEFONES}/${tel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    } else {
      requisicoes.push(
        authFetch(`${API_CLIENTES}/${clienteId}/telefones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    }
  });

  await Promise.all(requisicoes);
}

async function sincronizarContas(clienteId) {
  const requisicoes = [];
  contasRemovidas.forEach(id => {
    requisicoes.push(authFetch(`${API_CONTAS}/${id}`, { method: "DELETE" }));
  });
  contasRemovidas = [];

  contasState.forEach(conta => {
    if (!conta.banco || !conta.agencia || !conta.conta) return;
    const payload = {
      banco: conta.banco,
      agencia: conta.agencia,
      conta: conta.conta,
      digito: conta.digito,
      tipo_conta: conta.tipo_conta,
      principal: conta.principal,
    };

    if (conta.id) {
      requisicoes.push(
        authFetch(`${API_CONTAS}/${conta.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    } else {
      requisicoes.push(
        authFetch(`${API_CLIENTES}/${clienteId}/contas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    }
  });

  await Promise.all(requisicoes);
}

async function sincronizarEmprego(clienteId) {
  const payload = coletarEmpregoPayload();
  const temDadosRelevantes = Object.values(payload).some(v => v);

  if (empregoRemovidoId) {
    await authFetch(`${API_EMPREGO}/${empregoRemovidoId}`, { method: "DELETE" });
    empregoRemovidoId = null;
    empregoAtualId = null;
  }

  if (!temDadosRelevantes) return;

  if (empregoAtualId) {
    const resp = await authFetch(`${API_EMPREGO}/${empregoAtualId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error("Erro ao atualizar vínculo profissional");
  } else {
    const resp = await authFetch(`${API_CLIENTES}/${clienteId}/empregos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error("Erro ao salvar vínculo profissional");
  }
}

async function sincronizarRenda(clienteId) {
  const payload = coletarRendaPayload();
  if (!payload) return;
  const resp = await authFetch(`${API_CLIENTES}/${clienteId}/renda`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Erro ao salvar renda.");
}

async function salvarCliente(e) {
  e.preventDefault();
  const btnSalvar = document.getElementById("btnSalvarCliente");
  btnSalvar.disabled = true;

  try {
    const dados = coletarDadosCliente();
    const id = document.getElementById("id").value;
    let clienteId = id;

    let resp;
    if (clienteId) {
      resp = await authFetch(`${API_CLIENTES}/${clienteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    } else {
      resp = await authFetch(API_CLIENTES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    }

    if (!resp.ok) throw new Error("Falha ao salvar cliente.");

    if (!clienteId) {
      const salvo = await resp.json();
      clienteId = salvo.id;
    }

    await sincronizarTelefones(clienteId);
    await sincronizarEmprego(clienteId);
    await sincronizarRenda(clienteId);
    await sincronizarContas(clienteId);

    fecharFormulario();
    carregarClientes();
  } catch (err) {
    console.error(err);
    alert("Não foi possível salvar o cliente.");
  } finally {
    btnSalvar.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  carregarDominios().then(() => {
    atualizarResumoRenda();
  });
  carregarClientes();

  document.getElementById("form-cliente").addEventListener("submit", salvarCliente);

  document.getElementById("filtroCliente")?.addEventListener("input", aplicarFiltroClientes);
  document.getElementById("btnVoltarStep")?.addEventListener("click", () => irParaStep(stepAtual - 1));
  document.getElementById("btnProximoStep")?.addEventListener("click", () => irParaStep(stepAtual + 1));
  document.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", () => irParaStep(Number(btn.dataset.step)));
  });

  document.getElementById("btnAddTelefone")?.addEventListener("click", adicionarTelefone);
  document.getElementById("btnAddConta")?.addEventListener("click", adicionarConta);
  document.getElementById("btnLimparEmprego")?.addEventListener("click", () => {
    if (empregoAtualId) empregoRemovidoId = empregoAtualId;
    limparEmpregoForm();
  });
  document.getElementById("renda_salario_bruto")?.addEventListener("input", atualizarResumoRenda);
  document.getElementById("renda_descontos")?.addEventListener("input", atualizarResumoRenda);

  document.getElementById("telefonesLista")?.addEventListener("input", event => {
    const row = event.target.closest(".telefone-row");
    if (!row) return;
    const index = Number(row.dataset.index);
    const field = event.target.dataset.field;
    if (field === "ddd" || field === "numero") {
      event.target.value = event.target.value.replace(/\D/g, "");
    }
    telefonesState[index][field] = event.target.value;
  });
  document.getElementById("telefonesLista")?.addEventListener("click", event => {
    const index = event.target.dataset.remove;
    if (index !== undefined) removerTelefone(Number(index));
  });

  document.getElementById("contasLista")?.addEventListener("input", event => {
    const row = event.target.closest(".conta-row");
    if (!row) return;
    const index = Number(row.dataset.index);
    const field = event.target.dataset.field;
    if (field) contasState[index][field] = event.target.value;
  });
  document.getElementById("contasLista")?.addEventListener("click", event => {
    if (event.target.dataset.removeConta !== undefined) {
      removerConta(Number(event.target.dataset.removeConta));
    }
    if (event.target.dataset.principal !== undefined) {
      const selected = Number(event.target.dataset.principal);
      contasState = contasState.map((conta, idx) => ({ ...conta, principal: idx === selected }));
      renderContas();
    }
  });

    // valida CPF quando o usuário sai do campo
  campoCPF?.addEventListener("blur", () => {
    const cpfValor = campoCPF.value.trim();
    if (!cpfValor) {
      campoCPF.classList.remove("campo-erro");
      if (erroCPFSpan) erroCPFSpan.textContent = "";
      return;
    }

    if (!validarCPF(cpfValor)) {
      campoCPF.classList.add("campo-erro");
      if (erroCPFSpan) erroCPFSpan.textContent = "CPF inválido.";
    } else {
      campoCPF.classList.remove("campo-erro");
      if (erroCPFSpan) erroCPFSpan.textContent = "";
    }
  });


  atualizarStepsUI();
  resetEstadosComplementares();
});
