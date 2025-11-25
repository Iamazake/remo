const API_URL = "http://localhost:3000/api/clientes";

let listaClientes = [];

function validarCPF(cpf) {
    // remove tudo que não é número
    cpf = String(cpf).replace(/\D/g, '');

    // tem que ter 11 dígitos
    if (cpf.length !== 11) return false;

    // rejeita sequências tipo 00000000000, 11111111111 etc
    if (/^(\d)\1+$/.test(cpf)) return false;

    // primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;

    // segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;

    return true;
}

function authFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login.html";
        throw new Error("Token não encontrado");
    }

    const headers = {
        "Authorization": `Bearer ${token}`,
        ...(options.headers || {})
    };

    return fetch(url, { ...options, headers });
}

// LISTAR
async function carregarClientes() {
    try {
        const resposta = await authFetch(API_URL);

        if (!resposta.ok) {
            throw new Error("Falha ao buscar clientes");
        }

        listaClientes = await resposta.json();
        montarTabela(listaClientes);
        

    } catch (err) {
        alert("Não foi possível carregar a lista de clientes!");
        console.error(err);
    }
}

function formatarRenda(valor) {
    if (valor === null || valor === undefined || valor === "") return "";

    const numero = Number(valor);
    if (isNaN(numero)) return valor;

    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2
    });
}

function renderSituacaoProfissional(situacao) {
    if (!situacao) return "";
    return `<span class="tag-situacao">${situacao}</span>`;
}

function formatarRenda(valor) {
    if (valor === null || valor === undefined || valor === "") return "";

    const numero = Number(valor);
    if (isNaN(numero)) return valor;

    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2
    });
}

function formatarDataCurta(dataISO) {
    if (!dataISO) return "";
    const str = String(dataISO);
    // pega só a parte da data
    const parteData = str.split("T")[0].split(" ")[0];
    const [ano, mes, dia] = parteData.split("-");
    if (!ano || !mes || !dia) return str;
    return `${dia}/${mes}/${ano}`;
}

function renderSituacaoProfissional(situacao) {
    if (!situacao) return "";
    return `<span class="tag-situacao">${situacao}</span>`;
}

// define o "status" do cliente com base nos empréstimos
function calcularStatusCliente(c) {
    const total = Number(c.total_emprestimos || 0);
    const ativos = Number(c.emprestimos_ativos || 0);
    const parcelasAtrasadas = Number(c.parcelas_atrasadas || 0);
  
    // sem nenhum empréstimo ainda
    if (total === 0) {
      return { label: "Novo", nivel: "low" };
    }
  
    // qualquer parcela em atraso
    if (parcelasAtrasadas > 0) {
      return { label: "Inadimplente", nivel: "high" };
    }
  
    // tem empréstimo ativo mas sem atraso
    if (ativos > 0) {
      return { label: "Com empréstimo ativo", nivel: "medium" };
    }
  
    // já teve empréstimo, tudo pago
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
  

function renderStatusCliente(c) {
    const info = calcularStatusCliente(c);
    return `
        <span class="badge-cliente badge-${info.nivel}">
            <span class="dot-risk dot-${info.nivel}"></span>
            ${info.label}
        </span>
    `;
}

function renderResumoEmprestimos(c) {
    const total = Number(c.total_emprestimos || 0);
    const ativos = Number(c.emprestimos_ativos || 0);
    const atrasadas = Number(c.parcelas_atrasadas || 0);
  
    if (total === 0) return '<span class="txt-emprestimos">Nenhum registro</span>';
  
    let partes = [];
    partes.push(`${total} registro${total > 1 ? "s" : ""}`);
  
    if (ativos > 0) {
      partes.push(`${ativos} ativo${ativos > 1 ? "s" : ""}`);
    }
  
    if (atrasadas > 0) {
      partes.push(`${atrasadas} parcela${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`);
    }
  
    return `<span class="txt-emprestimos">${partes.join(" • ")}</span>`;
  }
  


function montarTabela(clientes) {
    const tbody = document.querySelector("tbody");
    tbody.innerHTML = "";

    clientes.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>
                <a href="/clientes/detalhe.html?id=${c.id}" class="link-cliente">
                    ${c.nome}
                </a>
                </td>
                <td>${c.cpf || ""}</td>
                <td>${c.telefone || ""}</td>
                <td>${formatarRenda(c.renda_mensal)}</td>
                <td>${renderSituacaoProfissional(c.situacao_profissional)}</td>
                <td>${renderStatusCliente(c)}</td>
                <td>${formatarDataCurta(c.data_cadastro)}</td>
                <td>${renderResumoEmprestimos(c)}</td>
                <td class="col-acoes">
                    <button class="btn-acao" title="Editar" onclick="editar(${c.id})">
                        ✏️
                    </button>
                    <button class="btn-acao excluir" title="Excluir" onclick="excluir(${c.id})">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    });
}



carregarClientes();

document.addEventListener("DOMContentLoaded", () => {
    const campo = document.getElementById("filtroCliente");
    if (campo) {
        campo.addEventListener("input", aplicarFiltroClientes);
    }
});


function aplicarFiltroClientes() {
    const campo = document.getElementById("filtroCliente");
    if (!campo) return;

    const termo = campo.value.trim().toLowerCase();

    if (!termo) {
        montarTabela(listaClientes);
        return;
    }

    const filtrados = listaClientes.filter((c) => {
        const nome = (c.nome || "").toLowerCase();
        const cpf = String(c.cpf || "");
        const tel = String(c.telefone || "");
        return (
            nome.includes(termo) ||
            cpf.includes(termo) ||
            tel.includes(termo)
        );
    });

    montarTabela(filtrados);
}



// MODAL
function abrirFormulario() {
    document.getElementById("modal").style.display = "flex";
}

function fecharFormulario() {
    document.getElementById("modal").style.display = "none";
    document.getElementById("form-cliente").reset();
}

// SALVAR (CRIAR OU EDITAR)
document.getElementById("form-cliente").addEventListener("submit", async function (e) {
    e.preventDefault();

    const id = document.getElementById("id").value;
    const nome = document.getElementById("nome").value;
    const cpfInput = document.getElementById("cpf");
    const rg = document.getElementById("rg").value;
    const telefone = document.getElementById("telefone").value;
    const situacao_profissional = document.getElementById("situacao_profissional").value;
    const renda_mensal_input = document.getElementById("renda_mensal").value;
    const observacoes = document.getElementById("observacoes").value;
    const erroCpf = document.getElementById("erro-cpf");
    
    // limpa mensagem/borda
    erroCpf.textContent = "";
    cpfInput.style.border = "none";
    
    const cpf = cpfInput.value.replace(/\D/g, ''); // manda só números
    
    if (cpf && !validarCPF(cpf)) {
        erroCpf.textContent = "CPF inválido";
        cpfInput.style.border = "1px solid #f97373";
        return;
    }
    
    // manda renda como string msm, o backend trata
    const dados = {
        nome,
        cpf,
        rg,
        telefone,
        renda_mensal: renda_mensal_input,
        situacao_profissional,
        observacoes
    };
    

    let resp;

    try {
        if (id) {
            resp = await authFetch(`${API_URL}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });
        } else {
            resp = await authFetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });
        }

        if (!resp.ok) {
            let msg = "Falha ao salvar cliente.";
            try {
                const corpo = await resp.json();
                if (corpo && corpo.error) msg = corpo.error;
            } catch (e) {
                // se não vier JSON, tenta texto simples
                try {
                    const texto = await resp.text();
                    if (texto) msg = texto;
                } catch {}
            }
        
            alert(msg);
            console.error("Erro da API:", resp.status, msg);
            return;
        }        

        fecharFormulario();
        carregarClientes();
    } catch (err) {
        alert("Não foi possível salvar o cliente.");
        console.error(err);
    }
});

// EDITAR
async function editar(id) {
    try {
        abrirFormulario();

        const resp = await authFetch(`${API_URL}/${id}`);

        if (!resp.ok) {
            throw new Error("Falha ao carregar cliente");
        }

        const c = await resp.json();

        document.getElementById("id").value = c.id || "";
        document.getElementById("nome").value = c.nome || "";
        document.getElementById("cpf").value = c.cpf || "";
        document.getElementById("rg").value = c.rg || "";
        document.getElementById("telefone").value = c.telefone || "";
        document.getElementById("situacao_profissional").value = c.situacao_profissional || "";
        document.getElementById("renda_mensal").value = c.renda_mensal || "";
        document.getElementById("observacoes").value = c.observacoes || "";
        
    } catch (err) {
        alert("Não foi possível carregar os dados do cliente.");
        console.error(err);
        fecharFormulario();
    }
}

// EXCLUIR
async function excluir(id) {
    if (!confirm("Deseja excluir este cliente?")) return;

    try {
        const resp = await authFetch(`${API_URL}/${id}`, { method: "DELETE" });

        if (!resp.ok) {
            throw new Error("Falha ao excluir");
        }

        carregarClientes();
    } catch (err) {
        alert("Não foi possível excluir o cliente.");
        console.error(err);
    }
}

// Inicializa a lista
carregarClientes();
