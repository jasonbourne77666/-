#!/bin/sh
# 本机测试、编四个架构的 libpkg.so，打成可上传的 native/{md5}.bin。
# 用法：./build.sh test | so | pack | all
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
MODE="${1:-all}"
if [ -z "${CMAKE:-}" ]; then
  CMAKE="$HOME/Library/Android/sdk/cmake/4.1.2/bin/cmake"
fi
if [ -n "${ANDROID_NDK_HOME:-}" ]; then
  NDK="$ANDROID_NDK_HOME"
elif [ -n "${ANDROID_NDK_ROOT:-}" ]; then
  NDK="$ANDROID_NDK_ROOT"
else
  NDK="$HOME/Library/Android/sdk/ndk/30.0.16248370"
fi
DEX="$ROOT/classes.dex"
ABIS="armeabi-v7a arm64-v8a x86 x86_64"

if [ ! -x "$CMAKE" ]; then
  echo "找不到 cmake：$CMAKE" >&2
  echo "可以设置 CMAKE=/你的/cmake 再运行。" >&2
  exit 1
fi

run_test() {
  mkdir -p "$ROOT/build/host"
  clang -Wall -Wextra -Werror -O2 -Isrc -o "$ROOT/build/host/a_star_test" \
    "$ROOT/src/a_star.c" "$ROOT/src/test_main.c"
  "$ROOT/build/host/a_star_test"
}

run_so() {
  if [ ! -f "$NDK/build/cmake/android.toolchain.cmake" ]; then
    echo "找不到 NDK：$NDK" >&2
    echo "可以设置 ANDROID_NDK_HOME 再运行。" >&2
    exit 1
  fi
  abi=""
  for abi in $ABIS; do
    echo "== 编译 $abi =="
    "$CMAKE" -S "$ROOT" -B "$ROOT/build/$abi" \
      -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
      -DANDROID_ABI="$abi" \
      -DANDROID_PLATFORM=android-21 \
      -DCMAKE_BUILD_TYPE=Release
    "$CMAKE" --build "$ROOT/build/$abi" --parallel
  done
}

run_pack() {
  stage="$ROOT/build/apk-root"
  out_dir="$ROOT/build/native"
  abi=""
  so=""
  sum=""
  size=""
  rm -rf "$stage"
  mkdir -p "$stage"
  if [ ! -f "$DEX" ]; then
    echo "找不到 classes.dex：$DEX" >&2
    exit 1
  fi
  cp "$DEX" "$stage/classes.dex"
  for abi in $ABIS; do
    so="$(find "$ROOT/build/$abi" -name libpkg.so -type f | head -n 1)"
    if [ -z "$so" ]; then
      echo "还没有 $abi 的 libpkg.so，先运行 ./build.sh so" >&2
      exit 1
    fi
    mkdir -p "$stage/lib/$abi"
    cp "$so" "$stage/lib/$abi/libpkg.so"
  done
  rm -rf "$out_dir"
  mkdir -p "$out_dir"
  (
    cd "$stage"
    zip -r -X -n .so "$out_dir/plugin.bin" classes.dex lib
  )
  sum="$(md5 -q "$out_dir/plugin.bin")"
  size="$(wc -c < "$out_dir/plugin.bin" | tr -d ' ')"
  mv "$out_dir/plugin.bin" "$out_dir/${sum}.bin"
  echo "bin: $out_dir/${sum}.bin"
  echo "object: native/${sum}.bin"
  echo "md5: $sum"
  echo "size: $size"
}

case "$MODE" in
  test) run_test ;;
  so) run_so ;;
  pack) run_pack ;;
  all)
    run_test
    run_so
    run_pack
    ;;
  *)
    echo "用法：./build.sh test | so | pack | all" >&2
    exit 1
    ;;
esac
