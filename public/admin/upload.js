// upload.js

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for local frontend on port 5500
app.use(cors({
  origin: ["http://localhost:5500", "http://127.0.0.1:5500"]
}));

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "images");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const sanitized = file.originalname.toLowerCase().replace(/[^a-z0-9\\-_\\.]/g, "-");
    cb(null, sanitized);
  }
});


const upload = multer({ storage: storage });

// Upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  return res.status(200).json({
    message: "Upload successful.",
    path: `/images/${req.file.filename}`
  });
});

app.listen(PORT, () => {
  console.log(`Upload API listening on port ${PORT}`);
});
