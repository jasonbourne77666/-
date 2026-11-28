import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sdk = join(homedir(), "Library/Android/sdk");
const cmake = process.env.CMAKE || join(sdk, "cmake/4.1.2/bin/cmake");
const ndk = process.env.ANDROID_NDK_HOME || process.env.ANDROID_NDK_ROOT || join(sdk, "ndk/30.0.16248370");
const toolchain = join(ndk, "build/cmake/android.toolchain.cmake");
// 源码在工程外的「梦脚资源/linglongso」。so 仍拷进梦脚工程的 插件/，打包才带得上。
const outRoot = join(root, "../../梦脚/插件");
const abis = ["arm64-v8a", "armeabi-v7a", "x86", "x86_64"];
const libs = ["liblinglong.so", "libmhxy_vision.so"];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(cmake)) {
  console.error(`找不到 cmake：${cmake}`);
  console.error("可以设置 CMAKE=/你的/cmake 再运行。");
  process.exit(1);
}
if (!existsSync(toolchain)) {
  console.error(`找不到 NDK：${ndk}`);
  console.error("可以设置 ANDROID_NDK_HOME 再运行。");
  process.exit(1);
}

for (const abi of abis) {
  const buildDir = join(root, "build", abi);
  console.log(`== 编译 ${abi} ==`);
  run(cmake, [
    "-S", root,
    "-B", buildDir,
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    `-DANDROID_ABI=${abi}`,
    "-DANDROID_PLATFORM=android-21",
    "-DANDROID_STL=c++_static",
    "-DCMAKE_BUILD_TYPE=Release",
  ]);
  run(cmake, ["--build", buildDir, "--parallel"]);

  const destDir = join(outRoot, abi);
  mkdirSync(destDir, { recursive: true });
  for (const name of libs) {
    const built = join(buildDir, name);
    if (!existsSync(built)) {
      console.error(`还没有 ${abi} 的 ${name}`);
      process.exit(1);
    }
    const dest = join(destDir, name);
    copyFileSync(built, dest);
    console.log(dest);
  }
}
