// 把 local/tuse/lua 里的图色脚本推到懒人调试工作目录，同名文件直接覆盖。
// 用法：node pushToWorkpalce.js
// 调试时 getWorkPath() 是手机上的 script/work，梦幻西游.lua 从 work/local/tuse/lua 读取。

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const luaDir = path.join(__dirname, "lua");
const remoteDir = "/data/local/tmp/lrwork/com.nx.nxprojit/script/work/local/tuse/lua";

const names = fs
  .readdirSync(luaDir)
  .filter((name) => name.endsWith(".lua") && fs.statSync(path.join(luaDir, name)).isFile())
  .sort((left, right) => left.localeCompare(right, "zh"));

if (names.length === 0) {
  throw new Error(`${luaDir} 里没有 .lua 文件`);
}

let devices = "";
try {
  devices = execFileSync("adb", ["devices"], { encoding: "utf8" });
} catch (error) {
  throw new Error(`adb 不可用：${error.message}`);
}
if (!/^[^\s]+\s+device$/im.test(devices)) {
  throw new Error("没有已连接的设备。请先接上手机并允许调试，再运行 node pushToWorkpalce.js");
}

execFileSync("adb", ["shell", "mkdir", "-p", remoteDir], { stdio: "inherit" });

for (const name of names) {
  execFileSync("adb", ["push", path.join(luaDir, name), `${remoteDir}/${name}`], { stdio: "inherit" });
  console.log(`覆盖 ${name}`);
}

console.log(`已推送 ${names.length} 个文件到 ${remoteDir}`);
