// src/controllers/tabelasJurosController.js
const db = require("../config/db");

// GET /api/tabelas-juros
async function listarTabelas(req, res) {
  try {
    const sql = `
      SELECT 
        t.id,
        t.nome,
        t.ano_referencia,
        t.descricao,
        t.ativo,
        t.criado_em,
        COUNT(f.id) AS qtd_faixas
      FROM tabelas_juros t
      LEFT JOIN tabelas_juros_faixas f ON f.tabela_id = t.id
      GROUP BY t.id
      ORDER BY t.ano_referencia DESC, t.nome ASC
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar tabelas de juros:", err);
    res.status(500).json({ error: "Erro ao listar tabelas de juros." });
  }
}

// GET /api/tabelas-juros/:id
async function buscarTabelaPorId(req, res) {
  try {
    const { id } = req.params;

    const [[tabela]] = await db.query(
      "SELECT * FROM tabelas_juros WHERE id = ?",
      [id]
    );

    if (!tabela) {
      return res.status(404).json({ error: "Tabela de juros não encontrada." });
    }

    const [faixas] = await db.query(
      `
      SELECT id, parcela_de, parcela_ate, taxa
      FROM tabelas_juros_faixas
      WHERE tabela_id = ?
      ORDER BY parcela_de ASC, parcela_ate ASC
    `,
      [id]
    );

    res.json({ ...tabela, faixas });
  } catch (err) {
    console.error("Erro ao buscar tabela de juros:", err);
    res.status(500).json({ error: "Erro ao buscar tabela de juros." });
  }
}

// POST /api/tabelas-juros
async function criarTabela(req, res) {
  let conn;
  try {
    let { nome, ano_referencia, descricao, ativo, faixas } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "Nome da tabela é obrigatório." });
    }

    ano_referencia =
      ano_referencia !== undefined && ano_referencia !== null && ano_referencia !== ""
        ? parseInt(ano_referencia, 10)
        : null;

    ativo =
      ativo === undefined || ativo === null
        ? 1
        : (String(ativo) === "1" || String(ativo).toLowerCase() === "true")
        ? 1
        : 0;

    if (!Array.isArray(faixas) || faixas.length === 0) {
      return res
        .status(400)
        .json({ error: "Informe pelo menos uma faixa de parcelas." });
    }

    // Normalizar faixas
    const faixasNormalizadas = [];
    for (const f of faixas) {
      const parcela_de = parseInt(f.parcela_de, 10);
      const parcela_ate = parseInt(f.parcela_ate, 10);
      const taxa = parseFloat(f.taxa);

      if (!parcela_de || !parcela_ate || isNaN(taxa)) {
        return res.status(400).json({
          error:
            "Todas as faixas precisam de 'parcela_de', 'parcela_ate' e 'taxa'.",
        });
      }
      if (parcela_de <= 0 || parcela_ate <= 0 || parcela_ate < parcela_de) {
        return res
          .status(400)
          .json({ error: "Intervalo de parcelas inválido em alguma faixa." });
      }

      faixasNormalizadas.push({ parcela_de, parcela_ate, taxa });
    }

    // garantir que as faixas estão em ordem e não "voltam"
    faixasNormalizadas.sort((a, b) => a.parcela_de - b.parcela_de);

    for (let i = 0; i < faixasNormalizadas.length; i++) {
      const atual = faixasNormalizadas[i];
      if (i > 0) {
        const anterior = faixasNormalizadas[i - 1];
        if (atual.parcela_de <= anterior.parcela_ate) {
          return res.status(400).json({
            error: `Faixa ${
              i + 1
            } deve começar em parcela maior que ${anterior.parcela_ate}.`,
          });
        }
      }
    }


    conn = await db.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `
      INSERT INTO tabelas_juros
        (nome, ano_referencia, descricao, ativo)
      VALUES (?, ?, ?, ?)
    `,
      [nome, ano_referencia, descricao || null, ativo]
    );

    const tabelaId = result.insertId;

    const sqlFaixa = `
      INSERT INTO tabelas_juros_faixas
        (tabela_id, parcela_de, parcela_ate, taxa)
      VALUES (?, ?, ?, ?)
    `;

    for (const f of faixasNormalizadas) {
      await conn.query(sqlFaixa, [
        tabelaId,
        f.parcela_de,
        f.parcela_ate,
        f.taxa,
      ]);
    }

    await conn.commit();

    res.status(201).json({
      id: tabelaId,
      message: "Tabela de juros criada com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao criar tabela de juros:", err);
    if (conn) {
      try {
        await conn.rollback();
      } catch (e) {
        console.error("Erro ao fazer rollback:", e);
      }
    }
    res.status(500).json({ error: "Erro ao criar tabela de juros." });
  } finally {
    if (conn) conn.release();
  }
}

// PUT /api/tabelas-juros/:id
async function atualizarTabela(req, res) {
  let conn;
  try {
    const { id } = req.params;
    let { nome, ano_referencia, descricao, ativo, faixas } = req.body;

    const [[existe]] = await db.query(
      "SELECT id FROM tabelas_juros WHERE id = ?",
      [id]
    );
    if (!existe) {
      return res.status(404).json({ error: "Tabela de juros não encontrada." });
    }

    if (!nome) {
      return res.status(400).json({ error: "Nome da tabela é obrigatório." });
    }

    ano_referencia =
      ano_referencia !== undefined && ano_referencia !== null && ano_referencia !== ""
        ? parseInt(ano_referencia, 10)
        : null;

    ativo =
      ativo === undefined || ativo === null
        ? 1
        : (String(ativo) === "1" || String(ativo).toLowerCase() === "true")
        ? 1
        : 0;

    if (!Array.isArray(faixas) || faixas.length === 0) {
      return res
        .status(400)
        .json({ error: "Informe pelo menos uma faixa de parcelas." });
    }
    const maxParcela = Math.max(...faixas.map(f => Number(f.parcela_ate)));
      if (maxParcela > 120) {
        alert("A quantidade máxima de parcelas permitida é 120.");
        return;
      }


    const faixasNormalizadas = [];
    for (const f of faixas) {
      const parcela_de = parseInt(f.parcela_de, 10);
      const parcela_ate = parseInt(f.parcela_ate, 10);
      const taxa = parseFloat(f.taxa);

      if (!parcela_de || !parcela_ate || isNaN(taxa)) {
        return res.status(400).json({
          error:
            "Todas as faixas precisam de 'parcela_de', 'parcela_ate' e 'taxa'.",
        });
      }
      if (parcela_de <= 0 || parcela_ate <= 0 || parcela_ate < parcela_de) {
        return res
          .status(400)
          .json({ error: "Intervalo de parcelas inválido em alguma faixa." });
      }

      faixasNormalizadas.push({ parcela_de, parcela_ate, taxa });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Atualiza cabeçalho da tabela
    await conn.query(
      `
      UPDATE tabelas_juros
      SET nome = ?, ano_referencia = ?, descricao = ?, ativo = ?
      WHERE id = ?
    `,
      [nome, ano_referencia, descricao || null, ativo, id]
    );

    // Substitui todas as faixas
    await conn.query(
      "DELETE FROM tabelas_juros_faixas WHERE tabela_id = ?",
      [id]
    );

    const sqlFaixa = `
      INSERT INTO tabelas_juros_faixas
        (tabela_id, parcela_de, parcela_ate, taxa)
      VALUES (?, ?, ?, ?)
    `;
    for (const f of faixasNormalizadas) {
      await conn.query(sqlFaixa, [
        id,
        f.parcela_de,
        f.parcela_ate,
        f.taxa,
      ]);
    }

    await conn.commit();

    res.json({ message: "Tabela de juros atualizada com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar tabela de juros:", err);
    if (conn) {
      try {
        await conn.rollback();
      } catch (e) {
        console.error("Erro ao fazer rollback:", e);
      }
    }
    res.status(500).json({ error: "Erro ao atualizar tabela de juros." });
  } finally {
    if (conn) conn.release();
  }
}

// DELETE /api/tabelas-juros/:id
async function excluirTabela(req, res) {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM tabelas_juros WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tabela de juros não encontrada." });
    }

    res.json({ message: "Tabela de juros excluída com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir tabela de juros:", err);
    res.status(500).json({ error: "Erro ao excluir tabela de juros." });
  }
}

module.exports = {
  listarTabelas,
  buscarTabelaPorId,
  criarTabela,
  atualizarTabela,
  excluirTabela,
};
