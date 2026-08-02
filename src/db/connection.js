const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chatbot_academico",
  waitForConnections: true,
  connectionLimit: 10,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    // Usuarios
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        correo VARCHAR(150) UNIQUE NOT NULL,
        carrera VARCHAR(100),
        password VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversaciones
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS conversaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        titulo VARCHAR(255) NOT NULL DEFAULT 'Nueva conversación',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    // Consultas
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS consultas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_conversacion INT NOT NULL,
        id_usuario INT,
        pregunta TEXT NOT NULL,
        respuesta TEXT NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE SET NULL,
        FOREIGN KEY (id_conversacion) REFERENCES conversaciones(id) ON DELETE CASCADE
      )
    `);

    // Rendimiento (nuevo — para predicción)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS rendimiento (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL UNIQUE,
        promedio FLOAT NOT NULL DEFAULT 0,
        asistencia FLOAT NOT NULL DEFAULT 0,
        cursos_aprobados INT NOT NULL DEFAULT 0,
        cursos_reprobados INT NOT NULL DEFAULT 0,
        actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    console.log("✅ Base de datos inicializada correctamente");
  } catch (err) {
    console.error("❌ Error inicializando base de datos:", err.message);
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };