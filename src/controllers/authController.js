const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

if (!JWT_SECRET) {
  console.warn("[AUTH] JWT_SECRET não definido. Configure no .env");
}

/**
 * POST /auth/login
 * body: { usuario, senha }
 */
async function login(req, res) {
  try {
    const { usuario, senha } = req.body || {};

    if (!usuario || !senha) {
      return res
        .status(400)
        .json({ error: "Usuário e senha são obrigatórios." });
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          login,
          senha_hash,
          status
        FROM usuarios
        WHERE login = ?
        LIMIT 1
      `,
      [usuario]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    const user = rows[0];

    // status = 1 (ativo), 0 (inativo)
    if (user.status === 0) {
      return res.status(403).json({ error: "Usuário inativo." });
    }

    if (!user.senha_hash) {
      console.error(
        `[AUTH] Usuário ${user.login} está sem senha_hash configurado no banco.`
      );
      return res
        .status(500)
        .json({ error: "Usuário sem senha configurada no sistema." });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Configuração de JWT ausente." });
    }

    const payload = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const safeUser = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      status: user.status,
      perfil: user.perfil,
    };

    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error("[AUTH] Erro no login:", err);
    return res.status(500).json({ error: "Erro interno no login." });
  }
}

module.exports = {
  login,
};
