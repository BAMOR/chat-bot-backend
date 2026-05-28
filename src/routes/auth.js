console.log("✅ Rutas de auth cargadas");

const express = require("express");
const { pool } = require("../db/connection");

const router = express.Router();

// POST /api/auth/registro
router.post("/registro", async (req, res) => {
  const { nombre, correo, carrera, password } = req.body;

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
  }

  try {
    const [existe] = await pool.execute(
      "SELECT id FROM usuarios WHERE correo = ?",
      [correo]
    );
    if (existe.length > 0) {
      return res.status(409).json({ error: "El correo ya está registrado" });
    }

    const [result] = await pool.execute(
      "INSERT INTO usuarios (nombre, correo, carrera, password) VALUES (?, ?, ?, ?)",
      [nombre, correo, carrera || null, password]
    );

    res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      id_usuario: result.insertId,
      nombre,
    });
  } catch (err) {
    console.error("❌ Error en registro:", err.message);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios" });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT id, nombre, correo, carrera FROM usuarios WHERE correo = ? AND password = ?",
      [correo, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    res.json({ mensaje: "Login exitoso", usuario: rows[0] });
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

module.exports = router;