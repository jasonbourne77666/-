// 把当前目录的素材打成 资源热更.lua 会下载的文件。
// 用法：node build.mjs
// 源目录不改名。每次先清空 build/，再按下面的顺序生成。
//
// 1. teaching/
//    只收 .jpg、.png。编号是去掉扩展名的文件名，例如 flag-guide.jpg → flag-guide。
//    按文件内容 MD5 复制为 build/teaching/{md5}.jpg|.png，与 build/packages 同级。
//    同时写出 h5/teaching-assets.json：编号 → { file, md5, size, object }，object 为 teaching/{md5}.jpg|.png。
// 2. runtime/
//    只收 .png、.json。编号同样来自原文件名，例如 shiwei-map-1002.png、shiwei-prefix.json。
//    复制为 build/runtime/{md5}.png|.json。
//    同时写出 h5/runtime-assets.json，object 为 runtime/{md5}.png|.json。
//    这两份清单必须先写好。后面打 H5 包时会把它们打进去，手机靠清单里的 object 再去下对应文件。
// 3. h5/
//    目录里的全部文件打进 zip，zip 内路径加上 menghuanUI/ 前缀。
//    必须有 index.html、box.html、updata.html、stats.html。
//    再去掉路径里含 /shiwei_maps/ 的文件，另打一份精简包。
//    两个 zip 都按压缩后的内容 MD5 命名，放到 build/packages/h5/{md5}.zip。
// 4. images/
//    只收 .png。zip 内用文件名，不保留子目录。
//    放到 build/packages/images/{md5}.zip。
// 5. native/
//    目录里必须恰好有一个 .bin。文件内容原样复制为 build/packages/native/{md5}.bin。
//    version.json 里这条的解压路径记为 unHR.apk。
// 6. 22c71a74182e1c6dee76e208bc73a515/
//    教师节答题素材。只收 .png，zip 内保持原文件名，解压后按文件名取图。
//    这包不进 version.json。文件名固定为 build/packages/teacher/22c71a74182e1c6dee76e208bc73a515.zip。
// 7. build/version.json
//    schema_version 为 1。groups.h5、groups.h5.lite、groups.images、groups.native
//    各带 md5、size、object、entries。object 形如 packages/h5/{md5}.zip。
//    release_id 由 h5、images、native 三个包的 MD5 拼起来再算一次 MD5。

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(root, "build");
const requiredPages = ["index.html", "box.html", "updata.html", "stats.html"];

function md5Of(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

async function walkFiles(dir) {
  const found = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "zh"));
    for (const entry of entries) {
      if (entry.name === ".DS_Store") {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile()) {
        found.push(full);
      }
    }
  }
  await visit(dir);
  return found;
}

function entryFor(relativePath, buffer) {
  return {
    md5: md5Of(buffer),
    path: relativePath,
    size: buffer.length,
  };
}

function assertLimits(name, entries, maxCount, maxTotal) {
  if (entries.length < 1 || entries.length > maxCount) {
    throw new Error(`${name} 条目数 ${entries.length} 超出 1..${maxCount}`);
  }
  const total = entries.reduce((sum, item) => sum + item.size, 0);
  if (total > maxTotal) {
    throw new Error(`${name} 解压后 ${total} 字节，超过 ${maxTotal}`);
  }
  for (const item of entries) {
    if (item.size < 1 || item.size > 10000000) {
      throw new Error(`${name} 文件 ${item.path} 大小 ${item.size} 不在 1..10000000`);
    }
  }
}

async function writeZip(files, zipPath) {
  const stage = path.join(buildDir, ".stage");
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(stage, { recursive: true });
  for (const file of files) {
    const target = path.join(stage, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.buffer);
  }
  await fs.rm(zipPath, { force: true });
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await execFileAsync("zip", ["-X", "-r", zipPath, "."], { cwd: stage });
  await fs.rm(stage, { recursive: true, force: true });
  return fs.readFile(zipPath);
}

function groupRecord(kind, extension, packageBytes, entries, extra) {
  const digest = md5Of(packageBytes);
  if (packageBytes.length > 10000000) {
    throw new Error(`${kind} 压缩包 ${packageBytes.length} 字节，超过 10000000`);
  }
  return {
    record: {
      ...extra,
      md5: digest,
      object: `packages/${kind}/${digest}${extension}`,
      size: packageBytes.length,
      entries,
    },
    fileName: `${digest}${extension}`,
  };
}

const catalogSpecs = {
  teaching: new Set([".jpg", ".png"]),
  runtime: new Set([".png", ".json"]),
};

async function prepareCatalog(folder) {
  const allowed = catalogSpecs[folder];
  const sourceDir = path.join(root, folder);
  await fs.access(sourceDir);
  const catalog = {};
  const outputs = [];
  for (const full of await walkFiles(sourceDir)) {
    const base = path.basename(full);
    const extension = path.extname(base).toLowerCase();
    const id = base.slice(0, base.length - extension.length);
    if (!allowed.has(extension)) {
      throw new Error(`${folder}/${base} 扩展名不支持`);
    }
    if (!/^[a-z0-9-]+$/.test(id) || id.length > 64) {
      throw new Error(`${folder}/${base} 编号不合法`);
    }
    if (catalog[id]) {
      throw new Error(`${folder} 编号重复 ${id}`);
    }
    const buffer = await fs.readFile(full);
    if (buffer.length < 1 || buffer.length > 10000000) {
      throw new Error(`${folder}/${base} 大小 ${buffer.length} 不在 1..10000000`);
    }
    const digest = md5Of(buffer);
    const item = {
      file: base,
      md5: digest,
      size: buffer.length,
      object: `${folder}/${digest}${extension}`,
    };
    catalog[id] = item;
    outputs.push({ object: item.object, buffer });
  }
  if (outputs.length === 0) {
    throw new Error(`${folder} 目录没有文件`);
  }
  const ordered = {};
  for (const id of Object.keys(catalog).sort((left, right) => left.localeCompare(right, "zh"))) {
    ordered[id] = catalog[id];
  }
  return {
    text: `${JSON.stringify(ordered, null, 2)}\n`,
    outputs,
  };
}

async function loadH5Files() {
  const sourceDir = path.join(root, "h5");
  const paths = await walkFiles(sourceDir);
  const files = [];
  for (const full of paths) {
    const relative = path.relative(sourceDir, full).split(path.sep).join("/");
    files.push({
      relativePath: `menghuanUI/${relative}`,
      buffer: await fs.readFile(full),
    });
  }
  return files;
}

async function main() {
  const h5Source = path.join(root, "h5");
  const imageSource = path.join(root, "images");
  const nativeSource = path.join(root, "native");
  const teaching = await prepareCatalog("teaching");
  const runtime = await prepareCatalog("runtime");
  await fs.writeFile(path.join(h5Source, "teaching-assets.json"), teaching.text);
  await fs.writeFile(path.join(h5Source, "runtime-assets.json"), runtime.text);
  await fs.access(imageSource);
  await fs.access(nativeSource);

  const h5Files = await loadH5Files();
  const pageNames = new Set(h5Files.map((file) => file.relativePath));
  for (const page of requiredPages) {
    if (!pageNames.has(`menghuanUI/${page}`)) {
      throw new Error(`h5 缺少 menghuanUI/${page}`);
    }
  }
  const h5Entries = h5Files.map((file) => entryFor(file.relativePath, file.buffer)).sort((left, right) => left.path.localeCompare(right.path, "zh"));
  assertLimits("h5", h5Entries, 100, 20000000);
  const liteFiles = h5Files.filter((file) => !file.relativePath.includes("/shiwei_maps/"));
  const liteEntries = liteFiles.map((file) => entryFor(file.relativePath, file.buffer)).sort((left, right) => left.path.localeCompare(right.path, "zh"));
  assertLimits("h5.lite", liteEntries, 100, 20000000);

  const imagePaths = (await walkFiles(imageSource)).filter((full) => full.endsWith(".png"));
  const imageFiles = [];
  for (const full of imagePaths) {
    const relativePath = path.basename(full);
    imageFiles.push({ relativePath, buffer: await fs.readFile(full) });
  }
  const imageEntries = imageFiles.map((file) => entryFor(file.relativePath, file.buffer)).sort((left, right) => left.path.localeCompare(right.path, "zh"));
  assertLimits("images", imageEntries, 500, 50000000);

  const nativeNames = (await fs.readdir(nativeSource)).filter((name) => name.endsWith(".bin") && name !== ".DS_Store");
  if (nativeNames.length !== 1) {
    throw new Error(`native 目录需要恰好一个 .bin，现在有 ${nativeNames.length} 个`);
  }
  const nativeBytes = await fs.readFile(path.join(nativeSource, nativeNames[0]));
  const nativeDigest = md5Of(nativeBytes);
  const nativeEntries = [{ md5: nativeDigest, path: "unHR.apk", size: nativeBytes.length }];
  assertLimits("native", nativeEntries, 1, 10000000);

  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(path.join(buildDir, "packages", "h5"), { recursive: true });
  await fs.mkdir(path.join(buildDir, "packages", "images"), { recursive: true });
  await fs.mkdir(path.join(buildDir, "packages", "native"), { recursive: true });

  const h5Zip = await writeZip(h5Files, path.join(buildDir, "packages", "h5", "pending.zip"));
  const h5 = groupRecord("h5", ".zip", h5Zip, h5Entries, {});
  const liteZip = await writeZip(liteFiles, path.join(buildDir, "packages", "h5", "pending-lite.zip"));
  const lite = groupRecord("h5", ".zip", liteZip, liteEntries, {});
  await fs.rename(path.join(buildDir, "packages", "h5", "pending.zip"), path.join(buildDir, "packages", "h5", h5.fileName));
  await fs.rename(path.join(buildDir, "packages", "h5", "pending-lite.zip"), path.join(buildDir, "packages", "h5", lite.fileName));

  const imageZip = await writeZip(imageFiles, path.join(buildDir, "packages", "images", "pending.zip"));
  const images = groupRecord("images", ".zip", imageZip, imageEntries, {});
  await fs.rename(path.join(buildDir, "packages", "images", "pending.zip"), path.join(buildDir, "packages", "images", images.fileName));

  const native = groupRecord("native", ".bin", nativeBytes, nativeEntries, {});
  await fs.writeFile(path.join(buildDir, "packages", "native", native.fileName), nativeBytes);

  const teacherName = "22c71a74182e1c6dee76e208bc73a515.zip";
  const teacherSource = path.join(root, "22c71a74182e1c6dee76e208bc73a515");
  await fs.access(teacherSource);
  const teacherPaths = (await walkFiles(teacherSource)).filter((full) => full.endsWith(".png"));
  if (teacherPaths.length < 1) {
    throw new Error("22c71a74182e1c6dee76e208bc73a515 里没有 png");
  }
  const teacherFiles = [];
  for (const full of teacherPaths) {
    teacherFiles.push({ relativePath: path.basename(full), buffer: await fs.readFile(full) });
  }
  await fs.mkdir(path.join(buildDir, "packages", "teacher"), { recursive: true });
  const teacherZip = await writeZip(teacherFiles, path.join(buildDir, "packages", "teacher", teacherName));

  for (const refreshed of [teaching, runtime]) {
    for (const item of refreshed.outputs) {
      const target = path.join(buildDir, item.object);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, item.buffer);
    }
  }

  const releaseId = md5Of(Buffer.from(`${h5.record.md5}${images.record.md5}${native.record.md5}`));
  const manifest = {
    groups: {
      h5: {
        entries: h5.record.entries,
        lite: {
          entries: lite.record.entries,
          md5: lite.record.md5,
          object: lite.record.object,
          size: lite.record.size,
        },
        md5: h5.record.md5,
        object: h5.record.object,
        size: h5.record.size,
      },
      images: {
        entries: images.record.entries,
        md5: images.record.md5,
        object: images.record.object,
        size: images.record.size,
      },
      native: {
        entries: native.record.entries,
        md5: native.record.md5,
        object: native.record.object,
        size: native.record.size,
      },
    },
    release_id: releaseId,
    schema_version: 1,
  };
  await fs.writeFile(path.join(buildDir, "version.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`version.json ${path.join(buildDir, "version.json")}`);
  console.log(`h5 ${h5.record.object} ${h5.record.size}`);
  console.log(`h5.lite ${lite.record.object} ${lite.record.size}`);
  console.log(`images ${images.record.object} ${images.record.size}`);
  console.log(`native ${native.record.object} ${native.record.size}`);
  console.log(`teacher packages/teacher/${teacherName} ${teacherZip.length}`);
  console.log(`teaching ${teaching.outputs.length} 个文件`);
  console.log(`runtime ${runtime.outputs.length} 个文件`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
