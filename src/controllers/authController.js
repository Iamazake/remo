const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

module.exports = {
    login: async (req, res) => {
        try {
            const { usuario, senha } = req.body;

            if (!usuario || !senha)
                return res.status(400).json({ error: "Usuário e senha obrigatórios." });

            const [rows] = await pool.query(
                "SELECT * FROM usuarios WHERE login = ? LIMIT 1",
                [usuario]
            );

            if (rows.length === 0)
                return res.status(404).json({ error: "Usuário não encontrado." });

            const user = rows[0];

            const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);

            if (!senhaCorreta)
                return res.status(401).json({ error: "Senha incorreta." });

            const token = jwt.sign(
                { id: user.id, nome: user.nome },
                process.env.JWT_SECRET || "segredo",
                { expiresIn: "8h" }
            );

            return res.json({ token, user });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Erro interno no login." });
        }
    },
};
