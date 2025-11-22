const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader)
        return res.status(401).json({ error: "Token não fornecido" });

    const token = authHeader.split(" ")[1];

    if (!token)
        return res.status(401).json({ error: "Token inválido" });

    jwt.verify(token, process.env.JWT_SECRET || "segredo", (err, user) => {
        if (err)
            return res.status(403).json({ error: "Token expirado ou inválido" });

        req.user = user; // Dados do usuário ficam acessíveis nas rotas
        next();
    });
};
