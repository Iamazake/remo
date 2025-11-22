const API_URL = "http://localhost:3000/api/clientes";

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
    const cpf = document.getElementById("cpf").value;
    const telefone = document.getElementById("telefone").value;
    const observacoes = document.getElementById("observacoes").value;

    const dados = { nome, cpf, telefone, observacoes };

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
            throw new Error("Falha ao salvar");
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
        document.getElementById("telefone").value = c.telefone || "";
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
