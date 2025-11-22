const db = require("../config/db");

// ======================== CRIAR CLIENTE ========================
async function criarCliente(req, res) {
    try {
        const {
            nome,
            cpf,
            rg,
            data_nascimento,
            telefone,
            endereco,
            cidade,
            estado,
            cep,
            observacoes
        } = req.body;

        if (!nome || !cpf)
            return res.status(400).json({ error: "Nome e CPF são obrigatórios." });

        const sql = `
            INSERT INTO clientes 
            (nome, cpf, rg, data_nascimento, telefone, endereco, cidade, estado, cep, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            nome,
            cpf,
            rg,
            data_nascimento,
            telefone,
            endereco,
            cidade,
            estado,
            cep,
            observacoes
        ]);

        res.json({ msg: "Cliente cadastrado com sucesso!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao cadastrar cliente." });
    }
}


// ======================== LISTAR CLIENTES ========================
async function listarClientes(req, res) {
    try {
        const [rows] = await db.query("SELECT * FROM clientes ORDER BY id DESC");
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
