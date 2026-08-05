import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    // Strip leading slashes so Windows path.join does not treat "/preview/..." as absolute.
    const relative = pathname.replace(/^[/\\]+/, "").replace(/\\/g, "/");
    const safePath = normalize(relative).replace(/^(\.\.(?:[/\\]|$))+/, "");
    let filePath = join(root, !safePath || safePath === "." ? "index.html" : safePath);
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("找不到頁面");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`SUDOX 已啟動：http://localhost:${port}`);
});
