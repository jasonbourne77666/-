// Reconstructed from libmhxy_vision.so (x86_64, not stripped, 13KB).
// Symbols are still present; this is the application logic in readable C++,
// equivalent to the compiler output rather than the original source text.
//
// It is the native fast path of 脚本/功能性封装.lua: one full-screen capture,
// then multi-point color search in the 懒人找色 string format.
// The capture must be exactly 1280x720. Byte 0/1/2 of each pixel are compared
// in the same channel order as the engine's colorToRGB(); color_order selects
// which way the 6 hex digits are split into those channels.

#include <cstdint>
#include <cstring>
#include <algorithm>
#include <vector>

enum {
    kScreenW = 1280,
    kScreenH = 720,
    kStride = 1280 * 4,
    kMaxTemplates = 0x1000,
    kMaxColorText = 0x200,
    kMaxOffsetText = 0x1000,
    kMaxColors = 512,
    kMaxPoints = 256,
    kClassEmpty = 1,
    kClassItem = 2
};

enum MhxyStatus {
    kOk = 0,
    kErrNull = -1,          // 0xFFFFFFFF
    kErrTooMany = -5,       // 0xFFFFFFFB
    kErrCapacity = -6,      // 0xFFFFFFFA
    kErrGeometry = -7,      // 0xFFFFFFF9
    kErrDirection = -9,     // 0xFFFFFFF7
    kErrReserved = -10,     // 0xFFFFFFF6
    kErrColorOrder = -21,   // 0xFFFFFFEB
    kErrColorText = -22,    // 0xFFFFFFEA
    kErrTooLong = -23,      // 0xFFFFFFE9
    kErrSimilarity = -28,   // 0xFFFFFFE4
    kErrNoApi = -25,        // 0xFFFFFFE7
    kErrSnapNull = -26,     // 0xFFFFFFE6
    kErrSnapSize = -27      // 0xFFFFFFE5
};

struct LrApi {
    void* self;
    uint8_t* (*snap)(int left, int top, int right, int bottom, int* out_w, int* out_h);
    void (*release)(uint8_t* pixels);
};

struct MhxyVisionScreenTextTemplate {
    int32_t left, top, right, bottom;
    const char* first_color;
    const char* offset_color;
    uint32_t first_color_length;
    uint32_t offset_color_length;
    uint32_t direction;
    uint32_t similarity_milli;
};

struct MhxyVisionScreenTextResult {
    uint32_t matched;
    uint32_t order_index;
    int32_t x, y;
};

struct MhxyVisionInventorySlot {
    int32_t translate_x, translate_y;
    uint32_t reserved0, reserved1;
};

struct MhxyVisionInventoryRequest {
    const MhxyVisionScreenTextTemplate* empty_template;
    const MhxyVisionScreenTextTemplate* item_templates;
    const MhxyVisionInventorySlot* slots;
    uint32_t item_template_count;
    uint32_t slot_count;
    uint32_t reserved0, reserved1;
};

struct MhxyVisionInventorySlotResult {
    uint32_t slot_index;
    uint32_t classification;   // 0 none, 1 empty template, 2 item template
    uint32_t template_index;   // item index, or -1 when empty / unmatched
    uint32_t reserved;
    int32_t x, y;
};

namespace {

struct CapturedScreen {
    uint8_t* pixels;
    int32_t width;
    int32_t height;
    int32_t stride;
    int32_t pad;
    int32_t min_x, min_y;   // 0, 0
    int32_t max_x, max_y;   // 1279, 719
};

struct Color {
    uint8_t ch[3];
    uint8_t tol[3];
    uint8_t pad[2];
};

struct Point {
    int32_t x, y;
    int32_t color_index;
    int32_t color_count;    // 0 means this point is ignored
};

struct Parsed {
    std::vector<Color> colors;
    std::vector<Point> points;
    int anchor_count = 0;
};

struct Cursor {
    const char* s;
    int length;
    int pos;
};

bool is_ws(unsigned char c) {
    // Bits 9, 10, 13 and 32 of 0x100002600: tab, LF, CR, space.
    return c == ' ' || c == '\t' || c == '\n' || c == '\r';
}

void skip_ws(Cursor& c) {
    while (c.pos < c.length && is_ws(static_cast<unsigned char>(c.s[c.pos])))
        ++c.pos;
}

int hex_value(unsigned char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

// Optional "0x", then exactly 6 hex digits. color_order 0 stores the integer
// little-endian into ch[0..2]; order 1 stores it big-endian.
bool parse_hex_color(Cursor& c, unsigned color_order, uint8_t out[3]) {
    skip_ws(c);
    if (c.pos + 2 <= c.length && c.s[c.pos] == '0') {
        unsigned char x = static_cast<unsigned char>(c.s[c.pos + 1]) | 0x20;
        if (x == 'x') c.pos += 2;
    }
    if (c.length - c.pos < 6) return false;
    uint32_t value = 0;
    for (int i = 0; i < 6; ++i) {
        int d = hex_value(static_cast<unsigned char>(c.s[c.pos + i]));
        if (d < 0) return false;
        value = (value << 4) | static_cast<uint32_t>(d);
    }
    c.pos += 6;
    uint8_t b0 = static_cast<uint8_t>(value);
    uint8_t b1 = static_cast<uint8_t>(value >> 8);
    uint8_t b2 = static_cast<uint8_t>(value >> 16);
    if (color_order == 0) {
        out[0] = b0; out[1] = b1; out[2] = b2;
    } else {
        out[0] = b2; out[1] = b1; out[2] = b0;
    }
    return true;
}

bool parse_color(Cursor& c, unsigned color_order, Color& color) {
    std::memset(&color, 0, sizeof(color));
    if (!parse_hex_color(c, color_order, color.ch)) return false;
    skip_ws(c);
    if (c.pos < c.length && c.s[c.pos] == '-') {
        ++c.pos;
        if (!parse_hex_color(c, color_order, color.tol)) return false;
    }
    return true;
}

bool parse_i32(Cursor& c, int32_t& out) {
    skip_ws(c);
    if (c.pos >= c.length) return false;
    int sign = 1;
    if (c.s[c.pos] == '+' || c.s[c.pos] == '-') {
        if (c.s[c.pos] == '-') sign = -1;
        ++c.pos;
    }
    if (c.pos >= c.length || hex_value(static_cast<unsigned char>(c.s[c.pos])) > 9
        || c.s[c.pos] > '9')
        return false;
    uint32_t mag = 0;
    uint32_t limit = sign < 0 ? 0x80000000u : 0x7fffffffu;
    while (c.pos < c.length) {
        unsigned char ch = static_cast<unsigned char>(c.s[c.pos]);
        if (ch < '0' || ch > '9') break;
        uint32_t d = ch - '0';
        if (mag > (limit - d) / 10) return false;
        mag = mag * 10 + d;
        ++c.pos;
    }
    if (sign < 0 && mag == 0x80000000u) out = static_cast<int32_t>(0x80000000u);
    else out = sign < 0 ? -static_cast<int32_t>(mag) : static_cast<int32_t>(mag);
    return true;
}

bool expect(Cursor& c, char mark) {
    skip_ws(c);
    if (c.pos >= c.length || c.s[c.pos] != mark) return false;
    ++c.pos;
    return true;
}

bool contains_comma(const char* s, int n) {
    for (int i = 0; i < n; ++i)
        if (s[i] == ',') return true;
    return false;
}

// first_color: COLOR ('|' COLOR)*
// offset_color without ',': (x '|' y '|' COLOR '|')*
// offset_color with ',':    (x '|' y '|' COLOR ('|' COLOR)* ',')*
int parse_colors(const MhxyVisionScreenTextTemplate& t, unsigned color_order, Parsed& out) {
    if (t.direction != 0) return kErrDirection;
    if (t.similarity_milli > 1000) return kErrSimilarity;
    if (t.first_color_length == 0 || t.first_color_length > kMaxColorText) return kErrTooLong;
    if (t.offset_color_length > kMaxOffsetText) return kErrTooLong;
    if (!t.first_color) return kErrNull;
    if (t.offset_color_length != 0 && !t.offset_color) return kErrNull;

    Cursor cur{t.first_color, static_cast<int>(t.first_color_length), 0};
    for (;;) {
        if (static_cast<int>(out.colors.size()) >= kMaxColors) return kErrTooLong;
        Color color;
        if (!parse_color(cur, color_order, color)) return kErrColorText;
        out.colors.push_back(color);
        ++out.anchor_count;
        skip_ws(cur);
        if (cur.pos >= cur.length) break;
        if (!expect(cur, '|')) return kErrColorText;
        skip_ws(cur);
        if (cur.pos >= cur.length) return kErrColorText;
    }

    if (t.offset_color_length == 0) return kOk;
    cur = Cursor{t.offset_color, static_cast<int>(t.offset_color_length), 0};
    bool grouped = contains_comma(t.offset_color, cur.length);
    skip_ws(cur);
    if (cur.pos >= cur.length) return kErrColorText;

    while (cur.pos < cur.length) {
        if (static_cast<int>(out.points.size()) >= kMaxPoints) return kErrTooLong;
        int32_t x = 0, y = 0;
        if (!parse_i32(cur, x) || !expect(cur, '|') || !parse_i32(cur, y) || !expect(cur, '|'))
            return kErrColorText;
        if (x < -32768 || x > 32767 || y < -32768 || y > 32767) return kErrColorText;
        Point pt;
        pt.x = x;
        pt.y = y;
        pt.color_index = static_cast<int>(out.colors.size());
        pt.color_count = 0;
        if (static_cast<int>(out.colors.size()) >= kMaxColors) return kErrTooLong;
        Color color;
        if (!parse_color(cur, color_order, color)) return kErrColorText;
        out.colors.push_back(color);
        ++pt.color_count;
        skip_ws(cur);
        if (!grouped) {
            out.points.push_back(pt);
            if (cur.pos >= cur.length) break;
            if (!expect(cur, '|')) return kErrColorText;
            skip_ws(cur);
            if (cur.pos >= cur.length) return kErrColorText;
            continue;
        }
        while (cur.pos < cur.length && !contains_comma(cur.s + cur.pos, 1)) {
            skip_ws(cur);
            if (cur.pos >= cur.length) break;
            if (cur.s[cur.pos] == ',') break;
            if (!expect(cur, '|')) return kErrColorText;
            if (static_cast<int>(out.colors.size()) >= kMaxColors) return kErrTooLong;
            if (!parse_color(cur, color_order, color)) return kErrColorText;
            out.colors.push_back(color);
            ++pt.color_count;
            skip_ws(cur);
        }
        out.points.push_back(pt);
        skip_ws(cur);
        if (cur.pos >= cur.length) break;
        if (!expect(cur, ',')) return kErrColorText;
        skip_ws(cur);
        if (cur.pos >= cur.length) return kErrColorText;
    }
    return kOk;
}

int check_rect(const MhxyVisionScreenTextTemplate& t, int tx, int ty, const CapturedScreen& screen) {
    if (t.direction != 0) return kErrDirection;
    if (t.similarity_milli > 1000) return kErrSimilarity;
    if (t.left > t.right || t.top > t.bottom) return kErrGeometry;
    int64_t x0 = static_cast<int64_t>(t.left) + tx;
    int64_t y0 = static_cast<int64_t>(t.top) + ty;
    int64_t x1 = static_cast<int64_t>(t.right) + tx;
    int64_t y1 = static_cast<int64_t>(t.bottom) + ty;
    if (x0 < screen.min_x || y0 < screen.min_y || x0 > screen.max_x || y0 > screen.max_y)
        return kErrGeometry;
    if (x1 > screen.max_x || y1 > screen.max_y) return kErrGeometry;
    return kOk;
}

int tolerance_floor(uint32_t similarity_milli) {
    // (1000 - similarity) * 255 / 1000
    return static_cast<int>((1000u - similarity_milli) * 255u / 1000u);
}

bool channel_ok(int pixel, int color, int tol, int floor_tol) {
    int allow = std::max(tol, floor_tol);
    int d = pixel - color;
    if (d < 0) d = -d;
    return d <= allow;
}

bool color_matches(const uint8_t* px, const Color& c, int floor_tol) {
    return channel_ok(px[0], c.ch[0], c.tol[0], floor_tol)
        && channel_ok(px[1], c.ch[1], c.tol[1], floor_tol)
        && channel_ok(px[2], c.ch[2], c.tol[2], floor_tol);
}

int required_hits(int point_count, uint32_t similarity_milli, bool all_points) {
    if (point_count <= 0) return 0;
    if (all_points) return point_count;
    // floor((similarity * count) / 8 / 1000), and at least 1.
    uint64_t q = (static_cast<uint64_t>(similarity_milli) * static_cast<uint64_t>(point_count)) / 8000u;
    return q >= 2 ? static_cast<int>(q) : 1;
}

bool find_first(const CapturedScreen& screen, const MhxyVisionScreenTextTemplate& box,
                const Parsed& parsed, bool all_points, int* out_x, int* out_y) {
    if (box.top > box.bottom || box.left > box.right || parsed.anchor_count <= 0) return false;
    int need = required_hits(static_cast<int>(parsed.points.size()), box.similarity_milli, all_points);
    int floor_tol = tolerance_floor(box.similarity_milli);
    const Color* colors = parsed.colors.data();

    for (int y = box.top; y <= box.bottom; ++y) {
        const uint8_t* row = screen.pixels + static_cast<size_t>(y) * screen.stride;
        for (int x = box.left; x <= box.right; ++x) {
            const uint8_t* px = row + x * 4;
            bool anchor = false;
            for (int i = 0; i < parsed.anchor_count; ++i) {
                if (color_matches(px, colors[i], floor_tol)) { anchor = true; break; }
            }
            if (!anchor) continue;

            int hits = 0;
            bool done = parsed.points.empty();
            for (size_t i = 0; i < parsed.points.size(); ++i) {
                const Point& pt = parsed.points[i];
                int px_x = x + pt.x;
                int px_y = y + pt.y;
                if (px_x < screen.min_x || px_y < screen.min_y
                    || px_x > screen.max_x || px_y > screen.max_y
                    || pt.color_count <= 0)
                    continue;
                const uint8_t* sample = screen.pixels
                    + static_cast<size_t>(px_y) * screen.stride + px_x * 4;
                bool any = false;
                for (int c = 0; c < pt.color_count; ++c) {
                    if (color_matches(sample, colors[pt.color_index + c], floor_tol)) {
                        any = true;
                        break;
                    }
                }
                if (!any) continue;
                if (++hits >= need) { done = true; break; }
            }
            if (hits >= need || done) {
                *out_x = x;
                *out_y = y;
                return true;
            }
        }
    }
    return false;
}

struct CaptureLease {
    LrApi* api;
    uint8_t* pixels = nullptr;

    explicit CaptureLease(LrApi* api) : api(api) {}
    ~CaptureLease() { if (pixels && api && api->release) api->release(pixels); }

    int capture(CapturedScreen& screen) {
        int w = 0, h = 0;
        pixels = api->snap(0, 0, 0, 0, &w, &h);
        if (!pixels) return kErrSnapNull;
        if (w != kScreenW || h != kScreenH) return kErrSnapSize;
        screen.pixels = pixels;
        screen.width = kScreenW;
        screen.height = kScreenH;
        screen.stride = kStride;
        screen.min_x = 0;
        screen.min_y = 0;
        screen.max_x = kScreenW - 1;
        screen.max_y = kScreenH - 1;
        return kOk;
    }
};

void clear_result(MhxyVisionScreenTextResult& r) {
    r.matched = 0;
    r.order_index = 0xffffffffu;
    r.x = -1;
    r.y = -1;
}

}  // namespace

extern "C" {

uint32_t mhxy_vision_version(void) { return 1; }

int32_t mhxy_vision_find_screen_text(int64_t lrapi, uint32_t color_order,
                                    const MhxyVisionScreenTextTemplate* templates,
                                    uint32_t count, MhxyVisionScreenTextResult* out_result) {
    if (!out_result) return kErrNull;
    if (count != 0 && !templates) return kErrNull;
    clear_result(*out_result);
    if (count > kMaxTemplates) return kErrTooMany;
    if (count == 0) return kOk;
    if (color_order > 1) return kErrColorOrder;

    auto* api = reinterpret_cast<LrApi*>(lrapi);
    if (!api) return kErrNoApi;
    if (!api->self || !api->snap || !api->release) return kErrNull;

    CaptureLease lease(api);
    CapturedScreen screen{};
    int rc = lease.capture(screen);
    if (rc != kOk) return rc;

    MhxyVisionInventorySlot origin{0, 0, 0, 0};
    for (uint32_t i = 0; i < count; ++i) {
        Parsed parsed;
        rc = check_rect(templates[i], 0, 0, screen);
        if (rc == kOk) rc = parse_colors(templates[i], color_order, parsed);
        if (rc != kOk) {
            out_result->order_index = i;
            return rc;
        }
        int x = 0, y = 0;
        MhxyVisionScreenTextTemplate moved = templates[i];
        (void)origin;
        if (!find_first(screen, moved, parsed, false, &x, &y)) continue;
        out_result->matched = 1;
        out_result->order_index = i;
        out_result->x = x;
        out_result->y = y;
        break;
    }
    return kOk;
}

int32_t mhxy_vision_classify_inventory_screen_text(int64_t lrapi, uint32_t color_order,
                                                  const MhxyVisionInventoryRequest* request,
                                                  MhxyVisionInventorySlotResult* results,
                                                  uint32_t capacity) {
    if (!request) return kErrNull;
    if (request->reserved0 != 0 || request->reserved1 != 0) return kErrReserved;
    if (request->item_template_count > kMaxTemplates || request->slot_count > kMaxTemplates)
        return kErrTooMany;
    uint64_t work = (static_cast<uint64_t>(request->item_template_count) + 1)
                    * request->slot_count;
    if (work > 0x100000u) return kErrTooMany;
    if (request->slot_count != 0) {
        if (!request->empty_template || !results || !request->slots) return kErrNull;
    }
    if (request->item_template_count != 0 && !request->item_templates) return kErrNull;
    if (request->slot_count == 0) return kOk;
    if (request->slot_count > capacity) return kErrCapacity;
    for (uint32_t i = 0; i < request->slot_count; ++i) {
        if (request->slots[i].reserved0 || request->slots[i].reserved1) return kErrReserved;
    }
    if (color_order > 1) return kErrColorOrder;

    auto* api = reinterpret_cast<LrApi*>(lrapi);
    if (!api) return kErrNoApi;
    if (!api->self || !api->snap || !api->release) return kErrNull;

    CaptureLease lease(api);
    CapturedScreen screen{};
    int rc = lease.capture(screen);
    if (rc != kOk) return rc;

    for (uint32_t s = 0; s < request->slot_count; ++s) {
        results[s].slot_index = s;
        results[s].classification = 0;
        results[s].template_index = 0xffffffffu;
        results[s].reserved = 0;
        results[s].x = -1;
        results[s].y = -1;
    }

    // Template 0 is the empty-slot pattern and must match every offset point.
    // Templates 1..n are item patterns and use the similarity quorum.
    uint32_t rounds = request->item_template_count + 1;
    for (uint32_t ti = 0; ti < rounds; ++ti) {
        const MhxyVisionScreenTextTemplate& src = ti == 0
            ? *request->empty_template
            : request->item_templates[ti - 1];
        const auto& slot0 = request->slots[0];
        rc = check_rect(src, slot0.translate_x, slot0.translate_y, screen);
        if (rc == kOk) {
            Parsed parsed;
            rc = parse_colors(src, color_order, parsed);
            if (rc != kOk) return rc;
            bool all_points = ti == 0;
            for (uint32_t s = 0; s < request->slot_count; ++s) {
                if (results[s].classification != 0) continue;
                rc = check_rect(src, request->slots[s].translate_x,
                                request->slots[s].translate_y, screen);
                if (rc != kOk) return rc;
                MhxyVisionScreenTextTemplate moved = src;
                moved.left += request->slots[s].translate_x;
                moved.top += request->slots[s].translate_y;
                moved.right += request->slots[s].translate_x;
                moved.bottom += request->slots[s].translate_y;
                int x = 0, y = 0;
                if (!find_first(screen, moved, parsed, all_points, &x, &y)) continue;
                results[s].classification = ti == 0 ? kClassEmpty : kClassItem;
                results[s].template_index = ti - 1;
                results[s].x = x;
                results[s].y = y;
            }
        } else {
            return rc;
        }
    }
    return kOk;
}

}  // extern "C"
