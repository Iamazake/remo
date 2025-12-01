// Pega o token igual nas outras telas
const token = localStorage.getItem("token");

if (!token) {
  // se não tiver token, volta pro login
  window.location.href = "/login.html";
}

// helper pra sempre mandar Authorization
function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}



function formatarRenda(valor) {
    if (valor === null || valor === undefined || valor === "") return "-";
    const numero = Number(valor);
    if (isNaN(numero)) return valor;
    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  }

  function formatCurrencyBR(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
  
  function formatarDataCurta(dataISO) {
    if (!dataISO) return "-";
    const str = String(dataISO);
    const parteData = str.split("T")[0].split(" ")[0];
    const [ano, mes, dia] = parteData.split("-");
    if (!ano || !mes || !dia) return str;
    return `${dia}/${mes}/${ano}`;
  }
  
  function calcularStatusCliente(c) {
    const total = Number(c.total_emprestimos || 0);
    const ativos = Number(c.emprestimos_ativos || 0);
    const atrasadas = Number(c.parcelas_atrasadas || 0);
  
    if (total === 0) {
      return { label: "Novo", nivel: "low" };
    }
  
    if (atrasadas > 0) {
      return { label: "Inadimplente", nivel: "high" };
    }
  
    if (ativos > 0) {
      return { label: "Com empréstimo ativo", nivel: "medium" };
    }
  
    return { label: "Em dia", nivel: "low" };
  }
  
  function renderBadgeStatus(c) {
    const info = calcularStatusCliente(c);
    return `
      <span class="badge-cliente badge-${info.nivel}">
        <span class="dot-risk dot-${info.nivel}"></span>
        ${info.label}
      </span>
    `;
  }
  
  async function carregarDetalhe() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
  
    if (!id) {
      document.getElementById("bloco-loading").innerText =
        "ID do cliente não informado.";
      return;
    }
  
    try {
        const resp = await authFetch(`/api/clientes/${id}/detalhes`);
        console.log("Status detalhes cliente:", resp.status);
        if (!resp.ok) {
            document.getElementById("bloco-loading").innerText =
              "Não foi possível carregar o cliente (erro " + resp.status + ").";
            return;
          }          
  
      const dados = await resp.json();
      const c = dados.cliente;
      const emprestimos = dados.emprestimos || [];

      // resumo financeiro (total em aberto, atrasado, média atraso)
      let resumo = null;
      try {
        const respResumo = await authFetch(`/api/clientes/${id}/resumo-financeiro`);
        if (respResumo.ok) {
          resumo = await respResumo.json();
        }
      } catch (e) {
        console.warn("Não foi possível carregar resumo financeiro:", e);
      }

  
      // título e card
      document.getElementById("titulo-cliente").innerText = `Cliente #${c.id}`;
      document.getElementById("dc-nome").innerText = c.nome;
      document.getElementById("dc-cpf").innerText = c.cpf || "-";
      document.getElementById("dc-telefone").innerText = c.telefone || "-";
      document.getElementById("dc-renda").innerText = formatarRenda(c.renda_mensal);
      document.getElementById("dc-situacao").innerText =
        c.situacao_profissional || "-";
      document.getElementById("dc-desde").innerText = formatarDataCurta(
        c.data_cadastro
      );
      document.getElementById("dc-status").innerHTML = renderBadgeStatus(c);
  
      document.getElementById("dc-total-emp").innerText =
        c.total_emprestimos || 0;
      document.getElementById("dc-ativos").innerText =
        c.emprestimos_ativos || 0;
      document.getElementById("dc-atrasadas").innerText =
        c.parcelas_atrasadas || 0;

        // preencher resumo financeiro nos novos cards
      if (resumo) {
        document.getElementById("dc-total-em-aberto").innerText =
          formatCurrencyBR(resumo.total_em_aberto);
        document.getElementById("dc-total-atraso").innerText =
          formatCurrencyBR(resumo.total_atrasado);
        document.getElementById("dc-media-atraso").innerText =
          resumo.media_dias_atraso
            ? resumo.media_dias_atraso.toFixed(1)
            : "0,0";
      } else {
        // fallback pra não deixar lixo na tela
        document.getElementById("dc-total-em-aberto").innerText = "R$ 0,00";
        document.getElementById("dc-total-atraso").innerText = "R$ 0,00";
        document.getElementById("dc-media-atraso").innerText = "0,0";
      }

  
      // botão novo empréstimo já com o cliente
      const btnNovo = document.getElementById("btn-novo-emprestimo");
      btnNovo.href = `/emprestimos/index.html?cliente_id=${c.id}`;
  
      // lista de empréstimos
      if (!emprestimos.length) {
        document.getElementById("area-sem-emprestimo").style.display = "block";
        document.getElementById("area-com-emprestimo").style.display = "none";
      } else {
        document.getElementById("area-sem-emprestimo").style.display = "none";
        document.getElementById("area-com-emprestimo").style.display = "block";
  
        const tbody = document.getElementById("tbody-emprestimos");
        tbody.innerHTML = "";
  
        emprestimos.forEach((e) => {
          tbody.innerHTML += `
            <tr>
              <td>#${e.id}</td>
              <td>${formatarRenda(e.valor_total)}</td>
              <td>${e.parcelas}</td>
              <td>${formatarDataCurta(e.data_inicio)}</td>
              <td>${e.status}</td>
            </tr>
          `;
        });
      }
  
      // troca tela de loading pelos dados
      document.getElementById("bloco-loading").style.display = "none";
      document.getElementById("bloco-detalhes").style.display = "grid";
    } catch (err) {
      console.error(err);
      document.getElementById("bloco-loading").innerText =
        "Erro ao carregar os dados do cliente.";
    }
  }
  
  document.addEventListener("DOMContentLoaded", carregarDetalhe);
