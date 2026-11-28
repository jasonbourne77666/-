// 给 local/tuse/lua 里的图色脚本去掉注释，写到 build/，再按这份字节算 MD5。
// 用法：node build.mjs
// 输出：build/图色1.lua 等（文件名不变）和 build/version.json
// lua/ 里的源文件保留注释。files 的值是去注释后文件的 MD5，正式包用它和 fileMD5 比较。

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const luaDir = path.join(root, "lua");
const buildDir = path.join(root, "build");
const manifestPath = path.join(buildDir, "version.json");
const preferred = ["图色1.lua", "图色2.lua", "图色3.lua", "新位图色.lua"];

function md5Of(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

function longBracket(source, index) {
  if (source[index] !== "[") {
    return null;
  }
  let cursor = index + 1;
  let equals = 0;
  while (cursor < source.length && source[cursor] === "=") {
    equals += 1;
    cursor += 1;
  }
  if (cursor >= source.length || source[cursor] !== "[") {
    return null;
  }
  return { equals, contentStart: cursor + 1 };
}

function stripLuaComments(source) {
  const parts = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "'" || char === '"') {
      let cursor = index + 1;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (source[cursor] === char) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      parts.push(source.slice(index, cursor));
      index = cursor;
      continue;
    }
    const bracket = longBracket(source, index);
    if (bracket) {
      const close = `]${"=".repeat(bracket.equals)}]`;
      const found = source.indexOf(close, bracket.contentStart);
      const cursor = found < 0 ? source.length : found + close.length;
      parts.push(source.slice(index, cursor));
      index = cursor;
      continue;
    }
    if (source.startsWith("--", index)) {
      const commentBracket = longBracket(source, index + 2);
      if (commentBracket) {
        const close = `]${"=".repeat(commentBracket.equals)}]`;
        const found = source.indexOf(close, commentBracket.contentStart);
        index = found < 0 ? source.length : found + close.length;
        parts.push(" ");
        continue;
      }
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd < 0 ? source.length : lineEnd;
      continue;
    }
    parts.push(char);
    index += 1;
  }
  return parts.join("");
}

function localTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

const entries = await fs.readdir(luaDir, { withFileTypes: true });
const names = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".lua"))
  .map((entry) => entry.name)
  .sort((left, right) => {
    const leftRank = preferred.indexOf(left);
    const rightRank = preferred.indexOf(right);
    if (leftRank !== -1 || rightRank !== -1) {
      if (leftRank === -1) {
        return 1;
      }
      if (rightRank === -1) {
        return -1;
      }
      return leftRank - rightRank;
    }
    return left.localeCompare(right, "zh");
  });

if (names.length === 0) {
  throw new Error(`${luaDir} 里没有 .lua 文件`);
}

await fs.mkdir(buildDir, { recursive: true });

const files = {};
for (const name of names) {
  const source = await fs.readFile(path.join(luaDir, name), "utf8");
  const stripped = Buffer.from(stripLuaComments(source), "utf8");
  await fs.writeFile(path.join(buildDir, name), stripped);
  files[name] = md5Of(stripped);
}

const manifest = {
  update_time: localTimestamp(),
  files,
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);

for (const name of names) {
  console.log(`${name}  ${files[name]}`);
}
console.log(`已写入 ${manifestPath}`);
