const express = require("express");
const Groq = require("groq-sdk");
const { pool } = require("../db/connection");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/prediccion/guardar — guarda datos de rendimiento
router.post("/guardar", async (req, res) => {
  const { id_usuario, promedio, asistencia, cursos_aprobados, cursos_reprobados } = req.body;
  if (!id_usuario) return res.status(400).json({ error: "id_usuario requerido" });

  try {
    // Verificar si ya existe registro
    const [[existente]] = await pool.execute(
      "SELECT id FROM rendimiento WHERE id_usuario = ?",
      [id_usuario]
    );

    if (existente) {
      await pool.execute(
        `UPDATE rendimiento
         SET promedio = ?, asistencia = ?, cursos_aprobados = ?, cursos_reprobados = ?, actualizado_en = NOW()
         WHERE id_usuario = ?`,
        [promedio, asistencia, cursos_aprobados || 0, cursos_reprobados || 0, id_usuario]
      );
    } else {
      await pool.execute(
        `INSERT INTO rendimiento (id_usuario, promedio, asistencia, cursos_aprobados, cursos_reprobados)
         VALUES (?, ?, ?, ?, ?)`,
        [id_usuario, promedio, asistencia, cursos_aprobados || 0, cursos_reprobados || 0]
      );
    }

    res.json({ mensaje: "Datos guardados correctamente" });
  } catch (err) {
    console.error("Error guardando rendimiento:", err.message);
    res.status(500).json({ error: "Error al guardar datos" });
  }
});

// GET /api/prediccion/:id_usuario — obtiene datos y predicción
router.get("/:id_usuario", async (req, res) => {
  const { id_usuario } = req.params;

  try {
    const [[datos]] = await pool.execute(
      "SELECT * FROM rendimiento WHERE id_usuario = ?",
      [id_usuario]
    );

    if (!datos) {
      return res.json({ existe: false });
    }

    // Modelo predictivo simple (regresión lineal manual)
    // y = m*x + b  donde x = promedio*0.6 + asistencia*0.4
    const score = (datos.promedio * 0.6) + (datos.asistencia * 0.4);
    const probabilidad_aprobar = Math.min(Math.max((score - 40) / 60 * 100, 0), 100);
    const riesgo_reprobacion = 100 - probabilidad_aprobar;

    let nivel_riesgo, color;
    if (riesgo_reprobacion < 25) {
      nivel_riesgo = "Bajo"; color = "green";
    } else if (riesgo_reprobacion < 55) {
      nivel_riesgo = "Medio"; color = "yellow";
    } else {
      nivel_riesgo = "Alto"; color = "red";
    }

    // Obtener análisis personalizado de la IA
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres AcadBot, analizas el rendimiento académico de estudiantes.
Responde SOLO con JSON válido sin texto adicional:
{
  "analisis": "2-3 oraciones analizando la situación del estudiante",
  "fortalezas": ["fortaleza 1", "fortaleza 2"],
  "areas_mejorar": ["área 1", "área 2"],
  "consejos": ["consejo concreto 1", "consejo concreto 2", "consejo concreto 3"]
}`
        },
        {
          role: "user",
          content: `Analiza este estudiante: Promedio=${datos.promedio}/100, Asistencia=${datos.asistencia}%, Cursos aprobados=${datos.cursos_aprobados}, Cursos reprobados=${datos.cursos_reprobados}. Riesgo de reprobación calculado: ${nivel_riesgo}.`
        }
      ],
      max_tokens: 512,
      temperature: 0.5,
    });

    let analisis_ia = null;
    try {
      const jsonMatch = completion.choices[0].message.content.match(/\{[\s\S]*\}/);
      analisis_ia = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch { analisis_ia = null; }

    res.json({
      existe: true,
      datos: {
        promedio: datos.promedio,
        asistencia: datos.asistencia,
        cursos_aprobados: datos.cursos_aprobados,
        cursos_reprobados: datos.cursos_reprobados,
      },
      prediccion: {
        probabilidad_aprobar: Math.round(probabilidad_aprobar),
        riesgo_reprobacion: Math.round(riesgo_reprobacion),
        nivel_riesgo,
        color,
        score: Math.round(score),
      },
      analisis_ia,
    });
  } catch (err) {
    console.error("Error en predicción:", err.message);
    res.status(500).json({ error: "Error al generar predicción" });
  }
});

module.exports = router;