const express = require("express");
const Groq = require("groq-sdk");
const { pool } = require("../db/connection");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/recomendaciones
// Analiza el historial del usuario y devuelve recomendaciones personalizadas con IA
router.post("/", async (req, res) => {
  const { id_usuario, carrera } = req.body;
  if (!id_usuario) return res.status(400).json({ error: "id_usuario requerido" });

  try {
    // Obtener las últimas 20 preguntas del usuario
    const [consultas] = await pool.execute(
      `SELECT pregunta FROM consultas
       WHERE id_usuario = ?
       ORDER BY creado_en DESC
       LIMIT 20`,
      [id_usuario]
    );

    const historial = consultas.map(c => c.pregunta).join("\n- ");

    const prompt = consultas.length > 0
      ? `El estudiante${carrera ? ` de ${carrera}` : ""} ha hecho estas consultas académicas recientemente:\n- ${historial}\n\nBasándote en sus intereses y áreas de consulta, recomienda 4 recursos académicos específicos y útiles.`
      : `Eres un asistente académico. El estudiante${carrera ? ` estudia ${carrera}` : ""} es nuevo y aún no ha hecho consultas. Recomienda 4 recursos académicos generales útiles para universitarios.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AcadBot, un sistema de recomendación académica inteligente.
Responde SOLO con un JSON válido con este formato exacto, sin texto adicional:
{
  "recomendaciones": [
    {
      "titulo": "Nombre del recurso o curso",
      "tipo": "Video|Libro|Curso|Artículo|Herramienta",
      "descripcion": "Descripción breve de 1-2 oraciones de por qué es útil",
      "url": "https://enlace-real.com",
      "nivel": "Básico|Intermedio|Avanzado"
    }
  ],
  "resumen": "Una oración explicando por qué estas recomendaciones son relevantes para este estudiante"
}`
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 1024,
      temperature: 0.6,
    });

    const texto = completion.choices[0].message.content;

    // Parsear el JSON de la respuesta
    let data;
    try {
      // Limpiar posibles caracteres extra antes del JSON
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      data = null;
    }

    if (!data) {
      return res.status(500).json({ error: "Error al procesar recomendaciones" });
    }

    res.json(data);
  } catch (err) {
    console.error("Error en recomendaciones:", err.message);
    res.status(500).json({ error: "Error al generar recomendaciones" });
  }
});

module.exports = router;