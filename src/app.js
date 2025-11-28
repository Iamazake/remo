// src/app.js (refatorado)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
//const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const clientesRoutes = require("./routes/clientesRoutes");
const contasRoutes = require("./routes/contasRoutes");
const dominiosRoutes = require("./routes/dominiosRoutes");
const empregosRoutes = require("./routes/empregosRoutes");
const emprestimosRoutes = require("./routes/emprestimosRoutes");
const pagamentosRoutes = require("./routes/pagamentosRoutes");
const telefonesRoutes = require("./routes/telefonesRoutes");
const tabelasJurosRoutes = require("./routes/tabelasJurosRoutes");


const app = express();

// Middlewares básicos
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: true,
  })
);
//app.use(
  //helmet({
    // Desliga CSP por enquanto, pra aceitar <script> inline e onclick=""
    //contentSecurityPolicy: false,
   // crossOriginEmbedderPolicy: false,
  //})
//);
app.use(morgan("dev"));
app.use(express.static("public"));

// Rate limit simples para evitar brute-force em produção
if (process.env.NODE_ENV === "production") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // 500 requisições por IP
  });
  app.use(limiter);
}

// Rotas
app.use("/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/contas", contasRoutes);
app.use("/api/dominios", dominiosRoutes);
app.use("/api/empregos", empregosRoutes);
app.use("/api/emprestimos", emprestimosRoutes);
app.use("/api/pagamentos", pagamentosRoutes);
app.use("/api/telefones", telefonesRoutes);
app.use("/api/tabelas-juros", tabelasJurosRoutes);


// 404 genérico
app.use((req, res, next) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

// Handler central de erros
app.use((err, req, res, next) => {
  console.error("[ERRO]", err);

  const status = err.statusCode || err.status || 500;
  const mensagem =
    status === 500
      ? "Erro interno no servidor."
      : err.message || "Erro na requisição.";

  res.status(status).json({ error: mensagem });
});

// Porta do servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Servidor Remo rodando na porta ${PORT}`);
});

module.exports = app;
