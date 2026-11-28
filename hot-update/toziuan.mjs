// 把同级 h5/ 打成 menghuanUI.zip，用来替换 资源/res/menghuanUI.zip。
// 用法：node toziuan.mjs
// zip 内路径带 menghuanUI/ 前缀，和解压后读 menghuanUI/index.html 的方式一致。
// 不收 .DS_Store、__MACOSX。完成后打印新 zip 的路径和 MD5。

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(here, "h5");
const zipPath = path.join(here, "menghuanUI.zip");
const requiredPages = [
  "index.html",
  "box.html",
  "customer-reply.html",
  "updata.html",
  "stats.html",
];

function 跳过(name) {
  return name === ".DS_Store" || name === "__MACOSX" || name.startsWith("._");
}

async function 收集文件(dir, base, found) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "zh"));
  for (const entry of entries) {
    if (跳过(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    const relative = base === "" ? entry.name : `${base}/${entry.name}`;
    if (entry.isDirectory()) {
      await 收集文件(full, relative, found);
    } else if (entry.isFile()) {
      found.push({ full, relative });
    }
  }
}

async function main() {
  for (const name of requiredPages) {
    await fs.access(path.join(sourceDir, name));
  }
  const files = [];
  await 收集文件(sourceDir, "", files);
  if (files.length === 0) {
    throw new Error("h5 目录没有可打包的文件");
  }
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "menghuanUI-"));
  try {
    const packedRoot = path.join(stage, "menghuanUI");
    await fs.mkdir(packedRoot, { recursive: true });
    for (const file of files) {
      const target = path.join(packedRoot, file.relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(file.full, target);
    }
    await fs.rm(zipPath, { force: true });
    await execFileAsync("zip", ["-X", "-r", zipPath, "menghuanUI"], { cwd: stage });
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
  const bytes = await fs.readFile(zipPath);
  const md5 = createHash("md5").update(bytes).digest("hex");
  console.log(zipPath);
  console.log(md5);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
