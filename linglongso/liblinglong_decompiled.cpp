// Reconstructed from liblinglong.so (x86_64, stripped, Android NDK r28 / clang 19, LTO).
// Application code is 0x1a230..0x1ca00. Everything after that is statically
// linked libc++ (exceptions, RTTI, operator new) and is not part of this library.
//
// This is a readable equivalent of the compiler output, not the original
// source. Names are recovered from the Lua FFI binding in 脚本/命令库.lua
// and from the control flow. The binary's threshold / morphology / thinning
// loops are SSE2-vectorized; the scalar code below is the same algorithm.
//
// Pixel format: packed RGBA, R at byte 0, G at 1, B at 2, A ignored.
// A gray-ink pixel is min(R,G,B) >= 70 && max(R,G,B) <= 205 && max-min <= 75.
//
// Return codes:
//    0  ok
//   -1  bad rectangle, step, frame count, or null image
//   -2  lrapi is null, or its snap / release slot is null
//   -5  finalize saw frame_count <= 0
//   -6  null output buffer, or capacity < out_width * out_height
//   -7  C++ exception, type index 2 (length_error("vector") from std::vector)
//   -8  other C++ allocation exception (bad_array_new_length)

#include <cstdint>
#include <cstring>
#include <algorithm>
#include <unistd.h>
#include <vector>

namespace {

constexpr int kInkMin = 70;     // 0x46
constexpr int kInkMax = 205;    // max < 0xCE
constexpr int kInkSpread = 75;  // max - min <= 75
constexpr int kDistInf = 9999;  // 0x270F
constexpr int kThinIters = 48;

struct LrApi {
    void* self;  // +0, unused by this .so
    // +8  snap a rectangle. On success returns an RGBA buffer of
    //     (right-left+1) * (bottom-top+1) pixels and writes those sizes.
    uint8_t* (*snap)(int left, int top, int right, int bottom,
                     int* out_w, int* out_h);
    // +16 release a buffer returned by snap.
    void (*release)(uint8_t* pixels);
};

LrApi* g_lrapi = nullptr;  // BSS 0x49eb0, written by linglong_set_lrapi

inline bool is_ink(uint8_t r, uint8_t g, uint8_t b) {
    int mn = std::min(r, std::min(g, b));
    int mx = std::max(r, std::max(g, b));
    return mn >= kInkMin && mx <= kInkMax && (mx - mn) <= kInkSpread;
}

inline bool sample(const uint8_t* rgba, int width, int height, int x, int y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const uint8_t* p = rgba + (static_cast<size_t>(y) * width + x) * 4;
    return is_ink(p[0], p[1], p[2]);
}

// 0x1a4c0. Each output cell covers the 2x2 block whose top-left is
// (ox * step, oy * step). The cell is a hit when at least ceil(n/2)
// of the in-bounds samples are ink. Hits accumulate across frames.
void accumulate_frame(const uint8_t* rgba, int width, int height, int step,
                      int out_w, int out_h, uint8_t* counts) {
    if (out_w <= 0 || out_h <= 0) return;
    for (int oy = 0; oy < out_h; ++oy) {
        for (int ox = 0; ox < out_w; ++ox) {
            int x = ox * step;
            int y = oy * step;
            int hits = 0;
            int n = 0;
            if (y < height) {
                if (x < width)     { ++n; hits += sample(rgba, width, height, x,     y); }
                if (x + 1 < width) { ++n; hits += sample(rgba, width, height, x + 1, y); }
            }
            if (y + 1 < height) {
                if (x < width)     { ++n; hits += sample(rgba, width, height, x,     y + 1); }
                if (x + 1 < width) { ++n; hits += sample(rgba, width, height, x + 1, y + 1); }
            }
            if (n == 0) continue;
            int need = (n + 1) / 2;  // ceil(n/2), matches shrl + adc
            if (hits >= need) counts[oy * out_w + ox] += 1;
        }
    }
}

int neighbor_on(const uint8_t* img, int w, int h, int x, int y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return img[y * w + x] != 0;
}

// 8-neighborhood count, center excluded. Same bounds pattern as 0x1ab1b.
int count_neighbors(const uint8_t* img, int w, int h, int x, int y) {
    int n = 0;
    for (int dy = -1; dy <= 1; ++dy)
        for (int dx = -1; dx <= 1; ++dx)
            if (dx || dy) n += neighbor_on(img, w, h, x + dx, y + dy);
    return n;
}

// Keep a lit pixel with >= 2 lit neighbors, and fill a dark pixel with >= 6.
void morphology(const uint8_t* in, uint8_t* out, int w, int h) {
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            int n = count_neighbors(in, w, h, x, y);
            int need = in[y * w + x] ? 2 : 6;
            out[y * w + x] = n >= need ? 1 : 0;
        }
    }
}

// Chamfer distance, 4-connected, foreground starts at 9999.
void distance_transform(const uint8_t* mask, int* dist, int w, int h) {
    int n = w * h;
    for (int i = 0; i < n; ++i) dist[i] = mask[i] ? kDistInf : 0;
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            int i = y * w + x;
            if (dist[i] <= 0) continue;
            int best = dist[i];
            if (y > 0) best = std::min(best, dist[i - w] + 1);
            if (x > 0) best = std::min(best, dist[i - 1] + 1);
            dist[i] = best;
        }
    }
    for (int y = h - 1; y >= 0; --y) {
        for (int x = w - 1; x >= 0; --x) {
            int i = y * w + x;
            if (dist[i] <= 0) continue;
            int best = dist[i];
            if (y + 1 < h) best = std::min(best, dist[i + w] + 1);
            if (x + 1 < w) best = std::min(best, dist[i + 1] + 1);
            dist[i] = best;
        }
    }
}

// 8-connected components. Drop a component unless it has at least 6 pixels
// and its thickest point has distance >= 4.
void keep_thick_components(uint8_t* mask, const int* dist, int w, int h) {
    int n = w * h;
    std::vector<uint8_t> seen(n, 0);
    std::vector<int> stack;
    std::vector<int> comp;
    static const int kDx[8] = {1, 1, 0, -1, -1, -1, 0, 1};
    static const int kDy[8] = {0, 1, 1, 1, 0, -1, -1, -1};

    std::vector<uint8_t> kept(n, 0);
    for (int i = 0; i < n; ++i) {
        if (!mask[i] || seen[i]) continue;
        stack.clear();
        comp.clear();
        stack.push_back(i);
        seen[i] = 1;
        int thick = 0;
        while (!stack.empty()) {
            int cur = stack.back();
            stack.pop_back();
            comp.push_back(cur);
            thick = std::max(thick, dist[cur]);
            int x = cur % w;
            int y = cur / w;
            for (int k = 0; k < 8; ++k) {
                int nx = x + kDx[k];
                int ny = y + kDy[k];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                int j = ny * w + nx;
                if (!mask[j] || seen[j]) continue;
                seen[j] = 1;
                stack.push_back(j);
            }
        }
        if (static_cast<int>(comp.size()) >= 6 && thick >= 4) {
            for (int j : comp) kept[j] = 1;
        }
    }
    std::memcpy(mask, kept.data(), n);
}

// Zhang-Suen thinning. Two sub-iterations, up to 48 rounds.
// p2..p9 are N, NE, E, SE, S, SW, W, NW.
void zhang_suen(uint8_t* img, int w, int h) {
    std::vector<int> kill;
    for (int iter = 0; iter < kThinIters; ++iter) {
        int removed = 0;
        for (int pass = 0; pass < 2; ++pass) {
            kill.clear();
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    if (!img[y * w + x]) continue;
                    int p2 = neighbor_on(img, w, h, x,     y - 1);
                    int p3 = neighbor_on(img, w, h, x + 1, y - 1);
                    int p4 = neighbor_on(img, w, h, x + 1, y);
                    int p5 = neighbor_on(img, w, h, x + 1, y + 1);
                    int p6 = neighbor_on(img, w, h, x,     y + 1);
                    int p7 = neighbor_on(img, w, h, x - 1, y + 1);
                    int p8 = neighbor_on(img, w, h, x - 1, y);
                    int p9 = neighbor_on(img, w, h, x - 1, y - 1);
                    int nb = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                    if (nb < 2 || nb > 6) continue;
                    int seq[9] = {p2, p3, p4, p5, p6, p7, p8, p9, p2};
                    int trans = 0;
                    for (int k = 0; k < 8; ++k)
                        trans += (seq[k] == 0 && seq[k + 1] == 1);
                    if (trans != 1) continue;
                    bool ok = pass == 0
                        ? (p2 * p4 * p6 == 0 && p4 * p6 * p8 == 0)
                        : (p2 * p4 * p8 == 0 && p2 * p6 * p8 == 0);
                    if (ok) kill.push_back(y * w + x);
                }
            }
            for (int i : kill) img[i] = 0;
            removed += static_cast<int>(kill.size());
        }
        if (removed == 0) break;
    }
}

int count_on(const uint8_t* p, int n) {
    int c = 0;
    for (int i = 0; i < n; ++i) c += (p[i] != 0);
    return c;
}

// 0x1a7d0. counts[i] is how many frames voted for cell i.
// A cell survives when count > frame_count/2.
int finalize(const uint8_t* counts, int frame_count, int out_w, int out_h,
             uint8_t* mask_out, uint8_t* skeleton_out, int capacity,
             int* out_mask_count, int* out_skeleton_count) {
    if (frame_count <= 0) return -5;
    if (!mask_out || !skeleton_out) return -6;
    int n = out_w * out_h;
    if (n > capacity) return -6;

    std::vector<uint8_t> binary(n, 0);
    int half = frame_count >> 1;
    for (int i = 0; i < n; ++i) binary[i] = counts[i] > half ? 1 : 0;

    std::vector<uint8_t> mask(n, 0);
    if (out_w > 0 && out_h > 0) morphology(binary.data(), mask.data(), out_w, out_h);

    std::vector<int> dist(n, 0);
    distance_transform(mask.data(), dist.data(), out_w, out_h);
    keep_thick_components(mask.data(), dist.data(), out_w, out_h);

    std::vector<uint8_t> skeleton(mask);
    zhang_suen(skeleton.data(), out_w, out_h);

    std::memcpy(mask_out, mask.data(), n);
    std::memcpy(skeleton_out, skeleton.data(), n);
    if (out_mask_count) *out_mask_count = count_on(mask.data(), n);
    if (out_skeleton_count) *out_skeleton_count = count_on(skeleton.data(), n);
    return 0;
}

int grid_size(int pixels, int step) {
    // (pixels - 1) / step + 1, done in the binary as unsigned div of (n - 1).
    return (pixels - 1) / step + 1;
}

}  // namespace

extern "C" {

int linglong_native_version(void) {  // 0x1a290
    return 1;
}

void linglong_set_lrapi(long long pointer) {  // 0x1a2a0
    g_lrapi = reinterpret_cast<LrApi*>(pointer);
}

// Not in the Lua cdef, but exported. `frames` is frame_count packed
// back-to-back, each frame width*height*4 bytes.
int linglong_preprocess_rgba(
    const uint8_t* frames, int frame_count, int width, int height, int step,
    uint8_t* mask_out, uint8_t* skeleton_out, int capacity,
    int* out_width, int* out_height,
    int* out_mask_count, int* out_skeleton_count)
{
    if (step <= 0 || height <= 0 || width <= 0 || !frames) return -1;
    if (frame_count < 1) return -1;

    int out_w = grid_size(width, step);
    int out_h = grid_size(height, step);
    if (out_width) *out_width = out_w;
    if (out_height) *out_height = out_h;

    int cells = out_w * out_h;
    std::vector<uint8_t> counts(cells, 0);
    const uint8_t* frame = frames;
    size_t stride = static_cast<size_t>(width) * height * 4;
    for (int i = 0; i < frame_count; ++i) {
        accumulate_frame(frame, width, height, step, out_w, out_h, counts.data());
        frame += stride;
    }
    return finalize(counts.data(), frame_count, out_w, out_h,
                    mask_out, skeleton_out, capacity,
                    out_mask_count, out_skeleton_count);
}

// 0x1c460. Rectangle is inclusive: pixel size is
// (right-left+1) by (bottom-top+1). frame_delay_ms is slept
// (via usleep(ms * 1000)) between successful capture attempts
// when it is > 0. Frames whose snap returns null or the wrong
// size are skipped and do not count toward the majority.
int linglong_preprocess(
    int left, int top, int right, int bottom,
    int step, int frame_count, int frame_delay_ms,
    uint8_t* mask_out, uint8_t* skeleton_out, int capacity,
    int* out_width, int* out_height,
    int* out_mask_count, int* out_skeleton_count)
{
    if (!g_lrapi || !g_lrapi->snap || !g_lrapi->release) return -2;

    int span_x = right - left;   // pixel_width - 1
    int span_y = bottom - top;   // pixel_height - 1
    if (span_x < 0 || span_y < 0 || step <= 0 || frame_count < 1) return -1;

    int out_w = span_x / step + 1;
    int out_h = span_y / step + 1;
    if (out_width) *out_width = out_w;
    if (out_height) *out_height = out_h;

    int pix_w = span_x + 1;
    int pix_h = span_y + 1;
    std::vector<uint8_t> counts(out_w * out_h, 0);
    int got_frames = 0;

    for (int i = 0; i < frame_count; ++i) {
        int bw = 0, bh = 0;
        uint8_t* pixels = g_lrapi->snap(left, top, right, bottom, &bw, &bh);
        if (pixels) {
            if (bw == pix_w && bh == pix_h) {
                accumulate_frame(pixels, pix_w, pix_h, step, out_w, out_h, counts.data());
                ++got_frames;
            }
            g_lrapi->release(pixels);
        }
        if (frame_delay_ms > 0 && i + 1 < frame_count)
            usleep(static_cast<useconds_t>(frame_delay_ms) * 1000);
    }

    int rc = finalize(counts.data(), got_frames, out_w, out_h,
                      mask_out, skeleton_out, capacity,
                      out_mask_count, out_skeleton_count);
    return rc;
}

}  // extern "C"
