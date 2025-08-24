import express from "express";
import fs from "fs";
import path from "path";
const app = express();

const __dirname = path.resolve();

app.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "../","data", req.params.filename);
  console.log(filePath);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // e.g. "bytes=1000-"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    console.log("sending chunk", start, end);
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "application/octet-stream",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    console.log("sending full file");
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
