const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const colors = require("colors");
const dotenv = require("dotenv");

const userRoutes = require("./routes/userRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");
const messageRoutes = require("./routes/messageRoutes.js");
const { notFound, errorHandler } = require("./middlewares/errorMiddlewares.js");

dotenv.config();
app.use(express.json());

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/MS-teams-Chat")
  .then(() =>
    console.log("MongoDB connected successfully".cyan.underline)
  )
  .catch((err) => console.error(err));

/* ================= ROUTES ================= */
app.use("/user", userRoutes);
app.use("/chat", chatRoutes);
app.use("/message", messageRoutes);

/* ================= SERVER ================= */
const server = http.createServer(app);

if (process.env.VERCEL !== "1") {
  const io = new Server(server, {
    pingTimeout: 60000,
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  /* ================= SOCKET LOGIC ================= */
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("setup", (userData) => {
      if (!userData || !userData._id) {
        console.log("Invalid user data");
        return;
      }
      socket.join(userData._id);
      socket.emit("connected");
    });

    socket.on("join chat", (roomId) => {
      socket.join(roomId);
    });

    socket.on("new message", (newMessage) => {
      const chat = newMessage.chat;
      if (!chat || !chat._id) return;

      // Emit to chat room ONLY
      socket.to(chat._id).emit("message received", newMessage);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}

/* ================= ERROR HANDLING ================= */
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

if (process.env.VERCEL !== "1") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`.yellow.bold);
  });
}

module.exports = app;
