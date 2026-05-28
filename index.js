const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { initDB } = require("./src/db/connection");
const chatRoutes          = require("./src/routes/chat");
const authRoutes          = require("./src/routes/auth");
const dashboardRoutes     = require("./src/routes/dashboard");
const recomendacionRoutes = require("./src/routes/recomendaciones");
const prediccionRoutes    = require("./src/routes/prediccion");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Rutas
app.use("/api/chat",            chatRoutes);
app.use("/api/auth",            authRoutes);
app.use("/api/dashboard",       dashboardRoutes);
app.use("/api/recomendaciones", recomendacionRoutes);
app.use("/api/prediccion",      prediccionRoutes);

app.get("/", (req, res) => res.json({ mensaje: "🤖 AcadBot Backend funcionando!" }));

app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  await initDB();
});