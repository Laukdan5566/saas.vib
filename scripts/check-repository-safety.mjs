import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", "uploads", "secrets"]);
const forbiddenNames = new Set([".env", "id_rsa", "id_ed25519"]);
const forbiddenExtensions = new Set([".pem", ".key", ".p12", ".pfx", ".dump", ".backup"]);
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    const name = relative(root, path).replaceAll("\\", "/");
    if (forbiddenNames.has(entry.name) || forbiddenExtensions.has(extname(entry.name).toLowerCase())) {
      failures.push(`${name}: arquivo sensivel`);
      continue;
    }
    if (entry.name.includes("\\")) failures.push(`${name}: caminho Windows gravado como nome de arquivo`);
    if (/\.(ts|tsx|js|mjs|json|md|ya?ml|example)$/i.test(entry.name)) {
      const text = await readFile(path, "utf8");
      if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
        failures.push(`${name}: chave privada incorporada`);
      }
    }
  }
}

await walk(root);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Repository safety check passed.");
