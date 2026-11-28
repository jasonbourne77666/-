# unHR.apk 寻路库

这个目录编译出 `libpkg.so`，再和现有的 `classes.dex` 打成 `unHR.apk`。`00起号.lua` 解九宫格拼图时加载它，调用导出函数 `a_star`。

库只算棋盘怎么走。屏幕坐标在 `脚本/00起号.lua` 的 `格子` 表里，不在这个库里。

## 和脚本的约定

输入是一行 JSON：

```json
[[2,8,3,1,0,4,7,6,5],[1,2,3,4,5,6,7,8,0],3,3]
```

四段依次是当前排列、目标排列、行数、列数。`0` 是空格，数字必须是 `0` 到 `8` 各出现一次。现在的脚本固定传 `3,3`，目标固定是 `[1,2,3,4,5,6,7,8,0]`。

返回也是 JSON 字符串：

- 成功：从当前盘到目标盘的每一手，包含起始盘。脚本从第二盘开始，取 `0` 的位置（从 1 数）去点击。
- 失败：`["BAD_JSON"]`、`["BAD_BOARD"]`、`["UNSUPPORTED"]`、`["UNSOLVABLE"]`。脚本看到第一个元素是字符串就只打印，不点击。

空格从第 8 格挪到第 9 格时，返回值是：

```json
[[1,2,3,4,5,6,7,0,8],[1,2,3,4,5,6,7,8,0]]
```

脚本会点击第 9 格。

## 目录

| 路径 | 作用 |
| --- | --- |
| `src/a_star.c` | A* 寻路和 JSON 读写。改算法只改这个文件 |
| `src/a_star.h` | 导出声明 |
| `src/test_main.c` | 在电脑上跑的检查 |
| `CMakeLists.txt` | 交给 Android NDK 编 `libpkg.so` |
| `build.sh` | 测试、编四个架构、打包 |
| `classes.dex` | 和 `build.sh` 放在同一目录。打包时原样放进插件，让 `LuaEngine.loadApk` 能装上 |

`classes.dex` 里的下载器类不会被解拼图调用。做寻路插件时不要改它，复制进 apk 即可。

## 开发

1. 改 `src/a_star.c`。函数名必须保持 `a_star`，参数和返回值保持 `const char *`。
2. 在这个目录运行：

```bash
./build.sh test
```

电脑上会编一个测试程序并跑完。已经解好的盘、走一步、无解、坏 JSON、两组乱序都必须通过。乱序用例会检查每一步都是空格和相邻格交换，并且最后一盘是目标。

## 构建 so

本机 CMake 和 NDK 的默认路径写在 `build.sh` 里：

- CMake：`~/Library/Android/sdk/cmake/4.1.2/bin/cmake`
- NDK：`~/Library/Android/sdk/ndk/30.0.16248370`

路径不同时先导出再编：

```bash
export CMAKE="$HOME/Library/Android/sdk/cmake/4.1.2/bin/cmake"
export ANDROID_NDK_HOME="$HOME/Library/Android/sdk/ndk/30.0.16248370"
./build.sh so
```

会编出四个架构：

- `build/armeabi-v7a/` 里的 `libpkg.so`
- `build/arm64-v8a/` 里的 `libpkg.so`（现在的真机用这个）
- `build/x86/` 里的 `libpkg.so`
- `build/x86_64/` 里的 `libpkg.so`

只编一个架构时，手机的 CPU 对不上会在加载阶段失败。四个都打进 apk。

## 打包

```bash
./build.sh pack
```

`./build.sh all` 会按顺序做测试、编译、打包。

打包结果是 `build/native/{md5}.bin`。这个文件本身就是压缩包，根上是 `classes.dex` 和 `lib/<架构>/libpkg.so`，`.so` 不压缩。文件名里的 md5 就是整份文件的 MD5。脚本结束时会打印 `object`、`md5` 和 `size`。

上传时对象路径要带资源根要求的 `packages/` 前缀，也就是 `packages/native/{md5}.bin`。`version.json` 的 native 写成：

```json
"native": {
  "md5": "脚本打印的 md5",
  "size": 123456,
  "object": "packages/native/脚本打印的 md5.bin",
  "entries": [
    { "path": "unHR.apk", "size": 123456, "md5": "脚本打印的 md5" }
  ]
}
```

`path` 仍然写 `unHR.apk`，不要改成 `.bin`。整包不超过 10MB。先上传这个 `.bin`，确认能直接下载，再覆盖 `version.json`。

换包后删掉手机上的 `mhxy-assets`，否则还会用上一版 native。

## 手机上怎么判断

- `ATTACHMENT_PREPARE_RESULT` 里 `native=true`：热更已经换上这个 apk。
- `ATTACHMENT_NATIVE_LOAD_RETURN` 里 `status=READY`：库加载成功。
- `status=FAILED` 时看 `stage`：`LOADER` 是 apk 结构坏了，`APK_PATH` 是安装路径里没有 `base.apk`，`FFI_LOAD` 是当前架构没有 `libpkg.so`，或者导出函数不是 `a_star`。
