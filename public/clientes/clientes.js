const API_URL = "http://localhost:3000/api/clientes";

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

        const clientes = await resposta.json();
        montarTabela(clientes);

    } catch (err) {
        alert("Não foi possível carregar a lista de clientes!");
        console.error(err);
    }
}


function montarTabela(clientes) {
    const tbody = document.querySelector("tbody");
    tbody.innerHTML = "";

    clientes.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${c.nome}</td>
                <td>${c.cpf || ""}</td>
                <td>${c.telefone || ""}</td>
                <td>
                    <button onclick="editar(${c.id})">Editar</button>
                    <button onclick="excluir(${c.id})">Excluir</button>
                </td>
            </tr>
        `;
    });
}

carregarClientes();


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
