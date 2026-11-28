#pragma once

/* 给 00起号.lua 的 ffi.load("libpkg.so") 调用。
 * 返回的字符串在下一次调用 a_star 之前有效。
 */
const char *a_star(const char *input_json);
