// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));


// Rotas
const authRoutes = require("./routes/authRoutes");
app.use("/auth", authRoutes);
const clientesRoutes = require("./routes/clientesRoutes");
app.use("/api/clientes", clientesRoutes);
const emprestimosRoutes = require('./routes/emprestimosRoutes');
app.use('/api/emprestimos', emprestimosRoutes);
const pagamentosRoutes = require('./routes/pagamentosRoutes');
app.use('/api/pagamentos', pagamentosRoutes);



// Porta do servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🔥 Servidor Remo rodando na porta ${PORT}`);
});
