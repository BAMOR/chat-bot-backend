const express = require("express");
const { pool } = require("../db/connection");

const router = express.Router();

// GET /api/dashboard/stats/:id_usuario
// Devuelve todas las estadísticas del dashboard
router.get("/stats/:id_usuario", async (req, res) => {
  const { id_usuario } = req.params;

  try {
    // Total de conversaciones del usuario
    const [[{ total_chats }]] = await pool.execute(
      "SELECT COUNT(*) as total_chats FROM conversaciones WHERE id_usuario = ?",
      [id_usuario]
    );

    // Total de consultas (mensajes) del usuario
    const [[{ total_consultas }]] = await pool.execute(
      "SELECT COUNT(*) as total_consultas FROM consultas WHERE id_usuario = ?",
      [id_usuario]
    );

    // Consultas por día (últimos 7 días)
    const [consultas_por_dia] = await pool.execute(
      `SELECT DATE(c.creado_en) as fecha, COUNT(*) as cantidad
       FROM consultas c
       WHERE c.id_usuario = ?
         AND c.creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(c.creado_en)
       ORDER BY fecha ASC`,
      [id_usuario]
    );

    // Últimas 5 consultas
    const [ultimas_consultas] = await pool.execute(
      `SELECT c.pregunta, c.creado_en, conv.titulo
       FROM consultas c
       JOIN conversaciones conv ON c.id_conversacion = conv.id
       WHERE c.id_usuario = ?
       ORDER BY c.creado_en DESC
       LIMIT 5`,
      [id_usuario]
    );

    // Temas más consultados (palabras clave simples)
    const [todas_preguntas] = await pool.execute(
      "SELECT pregunta FROM consultas WHERE id_usuario = ?",
      [id_usuario]
    );

    // Contar temas por palabras clave
    const temas = {
      "Matemáticas": 0,
      "Programación": 0,
      "Historia": 0,
      "Ciencias": 0,
      "Idiomas": 0,
      "Otros": 0,
    };
    const keywords = {
      "Matemáticas": ["mat", "álgebra", "cálculo", "ecuac", "geometr", "número", "formula"],
      "Programación": ["java", "python", "código", "programar", "función", "variable", "algorit", "web", "html", "css"],
      "Historia": ["histor", "guerra", "siglo", "revoluc", "coloniz", "nación"],
      "Ciencias": ["física", "química", "biolog", "átomo", "celula", "energía", "newton"],
      "Idiomas": ["inglés", "español", "gramática", "verbo", "idioma", "lenguaje", "traducir"],
    };

    for (const { pregunta } of todas_preguntas) {
      const lower = pregunta.toLowerCase();
      let encontrado = false;
      for (const [tema, words] of Object.entries(keywords)) {
        if (words.some(w => lower.includes(w))) {
          temas[tema]++;
          encontrado = true;
          break;
        }
      }
      if (!encontrado) temas["Otros"]++;
    }

    const temas_array = Object.entries(temas)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .filter(t => t.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad);

    res.json({
      total_chats,
      total_consultas,
      consultas_por_dia,
      ultimas_consultas,
      temas: temas_array,
    });
  } catch (err) {
    console.error("Error en dashboard:", err.message);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

module.exports = router;