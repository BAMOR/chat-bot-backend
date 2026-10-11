const express = require("express");
const Groq = require("groq-sdk");
const { pool } = require("../db/connection");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres AcadBot, un asistente académico inteligente y amigable para estudiantes universitarios.
Tu rol es:
- Responder preguntas sobre cualquier materia académica de forma clara y didáctica
- Dar consejos para mejorar el rendimiento académico  
- Orientar sobre métodos de estudio y técnicas de aprendizaje
- Ayudar con dudas sobre procesos universitarios
- Motivar y apoyar a los estudiantes en sus metas

Responde siempre en español, de forma clara y estructurada. Usa ejemplos cuando sea útil.`;

// ─── 1. OBTENER CONVERSACIONES ────────────────────────────────────────────────
router.get("/conversaciones/:id_usuario", async (req, res) => {
  const { id_usuario } = req.params;
  if (!id_usuario || id_usuario === "undefined")
    return res.status(400).json({ error: "ID de usuario inválido" });
  try {
    const [rows] = await pool.execute(
      "SELECT id, titulo, creado_en FROM conversaciones WHERE id_usuario = ? ORDER BY creado_en DESC",
      [id_usuario]
    );
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al obtener conversaciones" });
  }
});

// ─── 2. CREAR CONVERSACIÓN ────────────────────────────────────────────────────
router.post("/nueva-conversacion", async (req, res) => {
  const { id_usuario, titulo } = req.body;
  if (!id_usuario) return res.status(400).json({ error: "id_usuario requerido" });
  try {
    const [result] = await pool.execute(
      "INSERT INTO conversaciones (id_usuario, titulo) VALUES (?, ?)",
      [id_usuario, titulo || "Nueva conversación"]
    );
    res.status(201).json({ id_conversacion: result.insertId });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al crear conversación" });
  }
});

// ─── 3. OBTENER MENSAJES ──────────────────────────────────────────────────────
router.get("/mensajes/:id_conversacion", async (req, res) => {
  const { id_conversacion } = req.params;
  try {
    const [rows] = await pool.execute(
      "SELECT pregunta, respuesta, creado_en FROM consultas WHERE id_conversacion = ? ORDER BY creado_en ASC",
      [id_conversacion]
    );
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});

// ─── 4. ENVIAR MENSAJE ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { mensaje, id_conversacion, id_usuario } = req.body;
  if (!mensaje || !id_conversacion)
    return res.status(400).json({ error: "mensaje e id_conversacion son obligatorios" });

  try {
    // Traer historial para contexto
    const [historial] = await pool.execute(
      "SELECT pregunta, respuesta FROM consultas WHERE id_conversacion = ? ORDER BY creado_en ASC",
      [id_conversacion]
    );

    // Construir mensajes para Groq (formato OpenAI estándar)
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];
    for (const c of historial) {
      messages.push({ role: "user",      content: c.pregunta });
      messages.push({ role: "assistant", content: c.respuesta });
    }
    messages.push({ role: "user", content: mensaje });

    // Llamar a Groq
// Llamar a Groq
const completion = await groq.chat.completions.create({
  model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  messages,
  max_tokens: 1024,
  temperature: 0.7,
});

    const respuesta = completion.choices[0].message.content;

    // Actualizar título en el primer mensaje
    if (historial.length === 0) {
      const titulo = mensaje.substring(0, 50) + (mensaje.length > 50 ? "..." : "");
      await pool.execute(
        "UPDATE conversaciones SET titulo = ? WHERE id = ?",
        [titulo, id_conversacion]
      );
    }

    // Guardar en BD
    await pool.execute(
      "INSERT INTO consultas (id_conversacion, id_usuario, pregunta, respuesta) VALUES (?, ?, ?, ?)",
      [id_conversacion, id_usuario || null, mensaje, respuesta]
    );

    res.json({ respuesta });
  } catch (err) {
    console.error("Error en chat:", err.message);

    if (err.status === 401) {
      return res.status(500).json({ error: "❌ API key de Groq inválida. Ve a console.groq.com y genera una nueva." });
    }
    if (err.status === 429) {
      return res.status(500).json({ error: "⏳ Límite alcanzado. Espera unos segundos e intenta de nuevo." });
    }
    res.status(500).json({ error: "Error al procesar el mensaje. Intenta de nuevo." });
  }
});

module.exports = router;