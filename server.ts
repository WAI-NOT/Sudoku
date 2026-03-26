import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const configPath = path.join(process.cwd(), "saved_configs.json");

  // API Route to save a configuration
  app.post("/api/save-config", (req, res) => {
    try {
      const newConfig = req.body;
      let configs = [];
      if (fs.existsSync(configPath)) {
        configs = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      }
      configs.push({ ...newConfig, id: Date.now(), date: new Date().toISOString() });
      fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving config:", error);
      res.status(500).json({ error: "Failed to save configuration" });
    }
  });

  // API Route to load all configurations
  app.get("/api/load-configs", (req, res) => {
    try {
      if (fs.existsSync(configPath)) {
        const configs = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        res.json(configs);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error loading configs:", error);
      res.status(500).json({ error: "Failed to load configurations" });
    }
  });

  // API Route to delete a configuration
  app.delete("/api/delete-config/:id", (req, res) => {
    try {
      const { id } = req.params;
      if (fs.existsSync(configPath)) {
        let configs = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        configs = configs.filter((c: any) => c.id !== parseInt(id));
        fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "No configurations found" });
      }
    } catch (error) {
      console.error("Error deleting config:", error);
      res.status(500).json({ error: "Failed to delete configuration" });
    }
  });

  // Ensure uploads directory exists
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Serve uploads directory statically
  app.use("/uploads", express.static(uploadDir));

  // Multer setup for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });
  const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });

  // API Route for file uploads
  app.post("/api/upload", upload.single("file"), (req, res) => {
    console.log("Upload request received");
    if (!req.file) {
      console.error("No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = `/uploads/${req.file.filename}`;
    console.log("File uploaded successfully:", filePath);
    res.json({ url: filePath });
  });

  // API Route to download an image from a URL and save it locally
  app.post("/api/upload-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "No URL provided" });

      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
      });

      const contentType = response.headers["content-type"] || "";
      let extension = ".jpg";
      if (contentType.includes("png")) extension = ".png";
      else if (contentType.includes("gif")) extension = ".gif";
      else if (contentType.includes("webp")) extension = ".webp";
      else if (contentType.includes("svg")) extension = ".svg";

      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      const localPath = path.join(uploadDir, filename);
      const writer = fs.createWriteStream(localPath);

      response.data.pipe(writer);

      writer.on("finish", () => {
        res.json({ url: `/uploads/${filename}` });
      });

      writer.on("error", (err) => {
        console.error("Error writing file:", err);
        res.status(500).json({ error: "Failed to save image" });
      });
    } catch (error) {
      console.error("Error downloading image from URL:", error);
      res.status(500).json({ error: "Failed to download image" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
