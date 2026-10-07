import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

function dir() {
  return process.env["UPLOAD_DIR"] ?? path.resolve(process.cwd(), "uploads");
}

export async function saveFile(file: File) {
  await mkdir(dir(), { recursive: true });
  const ext = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 8);
  const name = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir(), name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function readStoredFile(name: string) {
  return readFile(path.join(dir(), path.basename(name)));
}

export async function removeFile(name: string) {
  await unlink(path.join(dir(), path.basename(name))).catch(() => {});
}
