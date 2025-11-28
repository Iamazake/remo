// src/config/db.js (refatorado)
const mysql = require("mysql2/promise");

const {
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  DB_PORT,
  DB_CONN_LIMIT,
  NODE_ENV,
} = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.warn("[DB] Variáveis de ambiente incompletas. Verifique .env");
}

const pool = mysql.createPool({
  host: DB_HOST || "localhost",
  user: DB_USER || "root",
  password: DB_PASS || "",
  database: DB_NAME || "remo",
  port: DB_PORT ? Number(DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: DB_CONN_LIMIT ? Number(DB_CONN_LIMIT) : 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

pool.on("connection", () => {
  if (NODE_ENV !== "test") {
    console.log("[DB] Nova conexão criada no pool");
  }
});

pool.on("error", (err) => {
  console.error("[DB] Erro no pool de conexões:", err);
});

module.exports = pool;
