const db = require("../config/db");
const dominiosService = require("../services/dominiosService");
const {
  toNullableDecimal,
  toNullableInt,
} = require("../utils/valueHelpers");

async function validarDominioOpcional(tipoDominio, valor, mensagemErro) {
  if (!valor) return null;
  const valido = await dominiosService.validarDominio(tipoDominio, valor);
  if (!valido) {
    const error = new Error(mensagemErro);
    error.statusCode = 400;
    throw error;
  }
  return valor;
}

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
      tipo_residencia,
      tempo_residencia_meses,
      observacoes,
      genero,
      estado_civil,
      escolaridade,
      numero_dependentes,
      nacionalidade,
      rg_orgao_emissor,
      rg_uf,
      rg_data_expedicao,
      nome_pai,
      nome_mae,
    } = req.body;

    if (!nome || !cpf) {
      return res
        .status(400)
        .json({ error: "Nome e CPF s�o obrigat�rios." });
    }

    cpf = String(cpf).replace(/\D/g, "");

    const rendaNormalizada = toNullableDecimal(renda_mensal);
    if (
      renda_mensal !== undefined &&
      renda_mensal !== null &&
      renda_mensal !== "" &&
      rendaNormalizada === null
    ) {
      return res.status(400).json({ error: "Renda mensal inv�lida." });
    }
    renda_mensal = rendaNormalizada;

    const tempoResidencia = toNullableInt(tempo_residencia_meses);
    if (
      tempo_residencia_meses !== undefined &&
      tempo_residencia_meses !== null &&
      tempo_residencia_meses !== "" &&
      tempoResidencia === null
    ) {
      return res
        .status(400)
        .json({ error: "Tempo de resid�ncia inv�lido." });
    }
    tempo_residencia_meses = tempoResidencia;

    const dependentesNormalizado = toNullableInt(numero_dependentes);
    if (
      numero_dependentes !== undefined &&
      numero_dependentes !== null &&
      numero_dependentes !== "" &&
      dependentesNormalizado === null
    ) {
      return res
        .status(400)
        .json({ error: "N�mero de dependentes inv�lido." });
    }
    numero_dependentes = dependentesNormalizado;

    tipo_residencia = await validarDominioOpcional(
      "dom_tipo_residencia",
      tipo_residencia,
      "Tipo de resid�ncia inv�lido."
    );
    genero = await validarDominioOpcional(
      "dom_genero",
      genero,
      "G�nero inv�lido."
    );
    estado_civil = await validarDominioOpcional(
      "dom_estado_civil",
      estado_civil,
      "Estado civil inv�lido."
    );
    escolaridade = await validarDominioOpcional(
      "dom_escolaridade",
      escolaridade,
      "Escolaridade inv�lida."
    );
    situacao_profissional = await validarDominioOpcional(
      "dom_situacao_profissional",
      situacao_profissional,
      "Situa��o profissional inv�lida."
    );

    const sql = `
      INSERT INTO clientes (
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
        tipo_residencia,
        tempo_residencia_meses,
        observacoes,
        genero,
        estado_civil,
        escolaridade,
        numero_dependentes,
        nacionalidade,
        rg_orgao_emissor,
        rg_uf,
        rg_data_expedicao,
        nome_pai,
        nome_mae
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [resultado] = await db.query(sql, [
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
      tipo_residencia || null,
      tempo_residencia_meses,
      observacoes || null,
      genero || null,
      estado_civil || null,
      escolaridade || null,
      numero_dependentes,
      nacionalidade || null,
      rg_orgao_emissor || null,
      rg_uf || null,
      rg_data_expedicao || null,
      nome_pai || null,
      nome_mae || null,
    ]);

    return res
      .status(201)
      .json({ id: resultado.insertId, msg: "Cliente cadastrado com sucesso!" });
  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ error: "CPF j� cadastrado para outro cliente." });
    }

    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
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
          c.genero,
          c.estado_civil,
          c.escolaridade,
          c.numero_dependentes,
          c.nacionalidade,
          c.rg,
          c.rg_orgao_emissor,
          c.rg_uf,
          c.rg_data_expedicao,
          c.nome_pai,
          c.nome_mae,
          
        

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
          c.genero,
          c.estado_civil,
          c.escolaridade,
          c.numero_dependentes,
          c.nacionalidade,
          c.rg,
          c.rg_orgao_emissor,
          c.rg_uf,
          c.rg_data_expedicao,
          c.nome_pai,
          c.nome_mae,
  
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
      tipo_residencia,
      tempo_residencia_meses,
      observacoes,
      genero,
      estado_civil,
      escolaridade,
      numero_dependentes,
      nacionalidade,
      rg_orgao_emissor,
      rg_uf,
      rg_data_expedicao,
      nome_pai,
      nome_mae,
    } = req.body;

    const [existe] = await db.query("SELECT id FROM clientes WHERE id = ?", [id]);
    if (!existe.length) {
      return res.status(404).json({ error: "Cliente n�o encontrado." });
    }

    if (!nome || !cpf) {
      return res
        .status(400)
        .json({ error: "Nome e CPF s�o obrigat�rios." });
    }

    cpf = String(cpf).replace(/\D/g, "");

    const rendaNormalizada = toNullableDecimal(renda_mensal);
    if (
      renda_mensal !== undefined &&
      renda_mensal !== null &&
      renda_mensal !== "" &&
      rendaNormalizada === null
    ) {
      return res.status(400).json({ error: "Renda mensal inv�lida." });
    }
    renda_mensal = rendaNormalizada;

    const tempoResidencia = toNullableInt(tempo_residencia_meses);
    if (
      tempo_residencia_meses !== undefined &&
      tempo_residencia_meses !== null &&
      tempo_residencia_meses !== "" &&
      tempoResidencia === null
    ) {
      return res
        .status(400)
        .json({ error: "Tempo de resid�ncia inv�lido." });
    }
    tempo_residencia_meses = tempoResidencia;

    const dependentesNormalizado = toNullableInt(numero_dependentes);
    if (
      numero_dependentes !== undefined &&
      numero_dependentes !== null &&
      numero_dependentes !== "" &&
      dependentesNormalizado === null
    ) {
      return res
        .status(400)
        .json({ error: "N�mero de dependentes inv�lido." });
    }
    numero_dependentes = dependentesNormalizado;

    tipo_residencia = await validarDominioOpcional(
      "dom_tipo_residencia",
      tipo_residencia,
      "Tipo de resid�ncia inv�lido."
    );
    genero = await validarDominioOpcional(
      "dom_genero",
      genero,
      "G�nero inv�lido."
    );
    estado_civil = await validarDominioOpcional(
      "dom_estado_civil",
      estado_civil,
      "Estado civil inv�lido."
    );
    escolaridade = await validarDominioOpcional(
      "dom_escolaridade",
      escolaridade,
      "Escolaridade inv�lida."
    );
    situacao_profissional = await validarDominioOpcional(
      "dom_situacao_profissional",
      situacao_profissional,
      "Situa��o profissional inv�lida."
    );

    const sql = `
      UPDATE clientes
      SET
        nome = ?,
        cpf = ?,
        rg = ?,
        data_nascimento = ?,
        telefone = ?,
        renda_mensal = ?,
        situacao_profissional = ?,
        endereco = ?,
        cidade = ?,
        estado = ?,
        cep = ?,
        tipo_residencia = ?,
        tempo_residencia_meses = ?,
        observacoes = ?,
        genero = ?,
        estado_civil = ?,
        escolaridade = ?,
        numero_dependentes = ?,
        nacionalidade = ?,
        rg_orgao_emissor = ?,
        rg_uf = ?,
        rg_data_expedicao = ?,
        nome_pai = ?,
        nome_mae = ?
      WHERE id = ?
    `;

    const params = [
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
      tipo_residencia || null,
      tempo_residencia_meses,
      observacoes || null,
      genero || null,
      estado_civil || null,
      escolaridade || null,
      numero_dependentes,
      nacionalidade || null,
      rg_orgao_emissor || null,
      rg_uf || null,
      rg_data_expedicao || null,
      nome_pai || null,
      nome_mae || null,
      id,
    ];

    await db.query(sql, params);

    return res.json({ msg: "Cliente atualizado com sucesso!" });
  } catch (err) {
    console.error(err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: "Erro ao editar cliente." });
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


