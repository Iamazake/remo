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
        const [rows] = await db.query(`
            SELECT 
                id,
                nome,
                cpf,
                telefone,
                renda_mensal,
                situacao_profissional
            FROM clientes
            ORDER BY id DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao listar clientes." });
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
    excluirCliente
};
