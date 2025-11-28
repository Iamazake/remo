// src/middlewares/auth.js (refatorado)
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALG = process.env.JWT_ALG || "HS256";

if (!JWT_SECRET) {
  console.warn("[AUTH] JWT_SECRET não definido. Configure no .env");
}

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Formato de token inválido" });
    }

    if (!JWT_SECRET) {
      return res
        .status(500)
        .json({ error: "Configuração de autenticação inválida" });
    }

    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });

    // Dados do usuário ficam acessíveis nas rotas
    req.user = {
      id: payload.id,
      nome: payload.nome,
      ...(payload.login && { login: payload.login }),
    };

    return next();
  } catch (err) {
    console.error("[AUTH] Erro na verificação do token:", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }

    return res.status(401).json({ error: "Token inválido" });
  }
};
