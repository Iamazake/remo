const db = require("../config/db");

// ======================== CRIAR CLIENTE ========================
async function criarCliente(req, res) {
    try {
        let {
            nome,
            cpf,
            rg,
            data_nascimento,
            telefone,
            renda_mensal,
            situacao_profissional,
            endereco,
            cidade,
            estado,
            cep,
            observacoes
        } = req.body;

        if (!nome || !cpf) {
            return res.status(400).json({ error: "Nome e CPF são obrigatórios." });
        }

        // CPF: só números
        cpf = String(cpf).replace(/\D/g, "");

        // Renda mensal: normaliza / valida (aceita vazio)
        if (renda_mensal !== undefined && renda_mensal !== null && renda_mensal !== "") {
            renda_mensal = String(renda_mensal).replace(",", ".");
            renda_mensal = Number(renda_mensal);
            if (Number.isNaN(renda_mensal) || renda_mensal < 0) {
                return res.status(400).json({ error: "Renda mensal inválida." });
            }
        } else {
            renda_mensal = null;
        }

        const sql = `
            INSERT INTO clientes
            (nome, cpf, rg, data_nascimento, telefone, renda_mensal, situacao_profissional,
             endereco, cidade, estado, cep, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            nome,
            cpf,
            rg || null,
            data_nascimento || null,
            telefone || null,
            renda_mensal,
            situacao_profissional || null,
            endereco || null,
            cidade || null,
            estado || null,
            cep || null,
            observacoes || null
        ]);

        return res.json({ msg: "Cliente cadastrado com sucesso!" });

    } catch (err) {
        console.error(err);

        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "CPF já cadastrado para outro cliente." });
        }

        return res.status(500).json({ error: "Erro ao cadastrar cliente." });
    }
}

// ======================== LISTAR CLIENTES ========================
async function listarClientes(req, res) {
    try {
      const sql = `
        SELECT
          c.id,
          c.nome,
          c.cpf,
          c.telefone,
          c.renda_mensal,
          c.situacao_profissional,
          c.data_cadastro,
  
          -- total de empréstimos do cliente
          (
            SELECT COUNT(*)
            FROM emprestimos e
            WHERE e.cliente_id = c.id
          ) AS total_emprestimos,
  
          -- quantos empréstimos estão ativos
          (
            SELECT COUNT(*)
            FROM emprestimos e
            WHERE e.cliente_id = c.id
              AND e.status = 'ativo'
          ) AS emprestimos_ativos,
  
          -- qtd de parcelas atrasadas (não pagas e com data_prevista < hoje)
          (
            SELECT COUNT(*)
            FROM pagamentos p
            JOIN emprestimos e2 ON e2.id = p.emprestimo_id
            WHERE e2.cliente_id = c.id
              AND p.status <> 'pago'
              AND p.data_prevista < CURDATE()
          ) AS parcelas_atrasadas
  
        FROM clientes c
        ORDER BY c.id DESC
      `;
  
      const [rows] = await db.query(sql);
  
      const normalizados = rows.map(r => ({
        ...r,
        total_emprestimos: r.total_emprestimos || 0,
        emprestimos_ativos: r.emprestimos_ativos || 0,
        parcelas_atrasadas: r.parcelas_atrasadas || 0
      }));
  
      res.json(normalizados);
    } catch (err) {
      console.error("Erro ao listar clientes:", err);
      res.status(500).json({ error: "Erro ao listar clientes." });
    }
  }
  

  // ======================== DETALHES DO CLIENTE ========================
async function detalhesCliente(req, res) {
    try {
      const id = req.params.id;
  
      // 1) dados do cliente + resumo
      const sqlCliente = `
        SELECT
          c.id,
          c.nome,
          c.cpf,
          c.telefone,
          c.renda_mensal,
          c.situacao_profissional,
          c.data_cadastro,
  
          (
            SELECT COUNT(*)
            FROM emprestimos e
            WHERE e.cliente_id = c.id
          ) AS total_emprestimos,
  
          (
            SELECT COUNT(*)
            FROM emprestimos e
            WHERE e.cliente_id = c.id
              AND e.status = 'ativo'
          ) AS emprestimos_ativos,
  
          (
            SELECT COUNT(*)
            FROM pagamentos p
            JOIN emprestimos e2 ON e2.id = p.emprestimo_id
            WHERE e2.cliente_id = c.id
              AND p.status <> 'pago'
              AND p.data_prevista < CURDATE()
          ) AS parcelas_atrasadas
        FROM clientes c
        WHERE c.id = ?
        LIMIT 1
      `;
  
      const [rowsCliente] = await db.query(sqlCliente, [id]);
      if (!rowsCliente.length) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }
      const cliente = {
        ...rowsCliente[0],
        total_emprestimos: rowsCliente[0].total_emprestimos || 0,
        emprestimos_ativos: rowsCliente[0].emprestimos_ativos || 0,
        parcelas_atrasadas: rowsCliente[0].parcelas_atrasadas || 0,
      };
  
      // 2) lista de empréstimos do cliente
      const sqlEmp = `
        SELECT
          e.id,
          e.valor_total,
          e.parcelas,
          e.data_inicio,
          e.status
        FROM emprestimos e
        WHERE e.cliente_id = ?
        ORDER BY e.id DESC
      `;
      const [emprestimos] = await db.query(sqlEmp, [id]);
  
      res.json({ cliente, emprestimos });
    } catch (err) {
      console.error("Erro em detalhesCliente:", err);
      res.status(500).json({ error: "Erro ao obter detalhes do cliente." });
    }
  }
  



// ======================== BUSCAR POR ID ========================
async function buscarCliente(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.query("SELECT * FROM clientes WHERE id = ?", [id]);

        if (rows.length === 0)
            return res.status(404).json({ error: "Cliente não encontrado." });

        res.json(rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar cliente." });
    }
}


// ======================== EDITAR CLIENTE ========================
async function editarCliente(req, res) {
    try {
        const { id } = req.params;
        const dados = req.body;

        const campos = [];
        const valores = [];

        for (let key in dados) {
            campos.push(`${key} = ?`);
            valores.push(dados[key]);
        }

        valores.push(id);

        const sql = `UPDATE clientes SET ${campos.join(", ")} WHERE id = ?`;

        await db.query(sql, valores);

        res.json({ msg: "Cliente atualizado com sucesso!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao editar cliente." });
    }
}


// ======================== EXCLUIR CLIENTE ========================
async function excluirCliente(req, res) {
    try {
        const { id } = req.params;

        await db.query("DELETE FROM clientes WHERE id = ?", [id]);

        res.json({ msg: "Cliente removido com sucesso!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao excluir cliente." });
    }
}


// ======================== EXPORTAR TODAS ========================
module.exports = {
    criarCliente,
    listarClientes,
    buscarCliente,
    editarCliente,
    excluirCliente,
    detalhesCliente
};
