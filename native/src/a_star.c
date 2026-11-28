#include "a_star.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* 3x3 数字华容道。Lua 传入：
 *   [当前9格, 目标9格, 行数, 列数]
 * 0 是空格。成功时返回从当前盘到目标盘的每一手棋盘。
 * 脚本只看后一盘里 0 的位置（从 1 数）并点击那一格。
 * 失败时返回 ["BAD_JSON"] / ["BAD_BOARD"] / ["UNSUPPORTED"] / ["UNSOLVABLE"]。
 */

#define BOARD_N 9
#define PERM_COUNT 362880
#define RESULT_CAP 8192

static char g_result[RESULT_CAP];

typedef struct {
    const char *p;
    const char *end;
} Cursor;

typedef struct {
    uint8_t tile[BOARD_N];
    int parent;
    int g;
} Node;

typedef struct {
    int f;
    int index;
} HeapItem;

static void skip_space(Cursor *cursor) {
    while (cursor->p < cursor->end) {
        char ch = *cursor->p;
        if (ch != ' ' && ch != '\n' && ch != '\r' && ch != '\t') {
            break;
        }
        cursor->p++;
    }
}

static int parse_int(Cursor *cursor, int *out) {
    int sign = 1;
    int value = 0;
    int digits = 0;
    skip_space(cursor);
    if (cursor->p >= cursor->end) {
        return 0;
    }
    if (*cursor->p == '-') {
        sign = -1;
        cursor->p++;
    }
    while (cursor->p < cursor->end && *cursor->p >= '0' && *cursor->p <= '9') {
        value = value * 10 + (*cursor->p - '0');
        cursor->p++;
        digits++;
        if (digits > 9) {
            return 0;
        }
    }
    if (digits == 0) {
        return 0;
    }
    *out = sign * value;
    return 1;
}

static int parse_board(Cursor *cursor, uint8_t tile[BOARD_N]) {
    int index;
    skip_space(cursor);
    if (cursor->p >= cursor->end || *cursor->p != '[') {
        return 0;
    }
    cursor->p++;
    for (index = 0; index < BOARD_N; index++) {
        int value;
        if (!parse_int(cursor, &value) || value < 0 || value > 8) {
            return 0;
        }
        tile[index] = (uint8_t)value;
        skip_space(cursor);
        if (index + 1 < BOARD_N) {
            if (cursor->p >= cursor->end || *cursor->p != ',') {
                return 0;
            }
            cursor->p++;
        }
    }
    skip_space(cursor);
    if (cursor->p >= cursor->end || *cursor->p != ']') {
        return 0;
    }
    cursor->p++;
    return 1;
}

static int is_permutation(const uint8_t tile[BOARD_N]) {
    int seen[BOARD_N];
    int index;
    memset(seen, 0, sizeof(seen));
    for (index = 0; index < BOARD_N; index++) {
        if (tile[index] > 8 || seen[tile[index]]) {
            return 0;
        }
        seen[tile[index]] = 1;
    }
    return 1;
}

static int same_board(const uint8_t left[BOARD_N], const uint8_t right[BOARD_N]) {
    return memcmp(left, right, BOARD_N) == 0;
}

static int inversion_parity(const uint8_t tile[BOARD_N]) {
    int parity = 0;
    int i;
    int j;
    for (i = 0; i < BOARD_N; i++) {
        if (tile[i] == 0) {
            continue;
        }
        for (j = i + 1; j < BOARD_N; j++) {
            if (tile[j] != 0 && tile[i] > tile[j]) {
                parity ^= 1;
            }
        }
    }
    return parity;
}

static int rank_of(const uint8_t tile[BOARD_N]) {
    static const int factorial[BOARD_N] = {1, 1, 2, 6, 24, 120, 720, 5040, 40320};
    int used[BOARD_N];
    int rank = 0;
    int index;
    memset(used, 0, sizeof(used));
    for (index = 0; index < BOARD_N; index++) {
        int smaller = 0;
        int value;
        for (value = 0; value < tile[index]; value++) {
            if (!used[value]) {
                smaller++;
            }
        }
        used[tile[index]] = 1;
        rank += smaller * factorial[8 - index];
    }
    return rank;
}

static int blank_at(const uint8_t tile[BOARD_N]) {
    int index;
    for (index = 0; index < BOARD_N; index++) {
        if (tile[index] == 0) {
            return index;
        }
    }
    return -1;
}

static int manhattan(const uint8_t tile[BOARD_N], const int goal_at[BOARD_N]) {
    int distance = 0;
    int index;
    for (index = 0; index < BOARD_N; index++) {
        int tile_value = tile[index];
        int goal;
        if (tile_value == 0) {
            continue;
        }
        goal = goal_at[tile_value];
        distance += abs(index / 3 - goal / 3) + abs(index % 3 - goal % 3);
    }
    return distance;
}

static void heap_push(HeapItem **heap, int *count, int *capacity, HeapItem item) {
    int index;
    if (*count == *capacity) {
        int next_capacity = *capacity == 0 ? 64 : *capacity * 2;
        HeapItem *grown = (HeapItem *)realloc(*heap, (size_t)next_capacity * sizeof(HeapItem));
        if (grown == NULL) {
            return;
        }
        *heap = grown;
        *capacity = next_capacity;
    }
    index = (*count)++;
    while (index > 0) {
        int parent = (index - 1) / 2;
        if ((*heap)[parent].f <= item.f) {
            break;
        }
        (*heap)[index] = (*heap)[parent];
        index = parent;
    }
    (*heap)[index] = item;
}

static HeapItem heap_pop(HeapItem *heap, int *count) {
    HeapItem top = heap[0];
    HeapItem last;
    int index = 0;
    (*count)--;
    if (*count == 0) {
        return top;
    }
    last = heap[*count];
    while (1) {
        int left = index * 2 + 1;
        int right = left + 1;
        int smallest = index;
        int smallest_f = last.f;
        if (left < *count && heap[left].f < smallest_f) {
            smallest = left;
            smallest_f = heap[left].f;
        }
        if (right < *count && heap[right].f < smallest_f) {
            smallest = right;
        }
        if (smallest == index) {
            break;
        }
        heap[index] = heap[smallest];
        index = smallest;
    }
    heap[index] = last;
    return top;
}

static int append_board(char *buffer, int used, const uint8_t tile[BOARD_N]) {
    int written = snprintf(
        buffer + used,
        (size_t)(RESULT_CAP - used),
        "[%u,%u,%u,%u,%u,%u,%u,%u,%u]",
        tile[0], tile[1], tile[2], tile[3], tile[4], tile[5], tile[6], tile[7], tile[8]);
    if (written < 0 || used + written >= RESULT_CAP) {
        return -1;
    }
    return used + written;
}

static const char *format_path(const Node *nodes, int goal_index) {
    int chain[64];
    int length = 0;
    int index = goal_index;
    int used = 0;
    int step;
    while (index >= 0 && length < 64) {
        chain[length++] = index;
        index = nodes[index].parent;
    }
    if (index >= 0) {
        return "[\"PATH_TOO_LONG\"]";
    }
    g_result[used++] = '[';
    for (step = length - 1; step >= 0; step--) {
        if (step != length - 1) {
            if (used + 1 >= RESULT_CAP) {
                return "[\"PATH_TOO_LONG\"]";
            }
            g_result[used++] = ',';
        }
        used = append_board(g_result, used, nodes[chain[step]].tile);
        if (used < 0) {
            return "[\"PATH_TOO_LONG\"]";
        }
    }
    if (used + 1 >= RESULT_CAP) {
        return "[\"PATH_TOO_LONG\"]";
    }
    g_result[used++] = ']';
    g_result[used] = '\0';
    return g_result;
}

static const char *solve(const uint8_t start[BOARD_N], const uint8_t goal[BOARD_N]) {
    int goal_at[BOARD_N];
    uint8_t *closed = NULL;
    Node *nodes = NULL;
    HeapItem *heap = NULL;
    int node_count = 0;
    int node_capacity = 1024;
    int heap_count = 0;
    int heap_capacity = 0;
    int index;
    const char *answer = "[\"UNSOLVABLE\"]";

    if (same_board(start, goal)) {
        Node single;
        memcpy(single.tile, start, BOARD_N);
        single.parent = -1;
        single.g = 0;
        return format_path(&single, 0);
    }
    if (inversion_parity(start) != inversion_parity(goal)) {
        return "[\"UNSOLVABLE\"]";
    }

    for (index = 0; index < BOARD_N; index++) {
        goal_at[goal[index]] = index;
    }
    closed = (uint8_t *)calloc(PERM_COUNT, 1);
    nodes = (Node *)malloc((size_t)node_capacity * sizeof(Node));
    if (closed == NULL || nodes == NULL) {
        answer = "[\"UNSOLVABLE\"]";
        goto done;
    }

    memcpy(nodes[0].tile, start, BOARD_N);
    nodes[0].parent = -1;
    nodes[0].g = 0;
    node_count = 1;
    {
        HeapItem item;
        item.f = manhattan(start, goal_at);
        item.index = 0;
        heap_push(&heap, &heap_count, &heap_capacity, item);
    }

    while (heap_count > 0) {
        HeapItem current = heap_pop(heap, &heap_count);
        Node *node = &nodes[current.index];
        int rank = rank_of(node->tile);
        int blank;
        int direction;
        static const int delta[4] = {-3, 3, -1, 1};
        if (closed[rank]) {
            continue;
        }
        closed[rank] = 1;
        if (same_board(node->tile, goal)) {
            answer = format_path(nodes, current.index);
            goto done;
        }
        blank = blank_at(node->tile);
        for (direction = 0; direction < 4; direction++) {
            int next_blank = blank + delta[direction];
            uint8_t moved[BOARD_N];
            int moved_rank;
            Node *child;
            HeapItem item;
            if (next_blank < 0 || next_blank >= BOARD_N) {
                continue;
            }
            if (delta[direction] == -1 && blank % 3 == 0) {
                continue;
            }
            if (delta[direction] == 1 && blank % 3 == 2) {
                continue;
            }
            memcpy(moved, node->tile, BOARD_N);
            moved[blank] = moved[next_blank];
            moved[next_blank] = 0;
            moved_rank = rank_of(moved);
            if (closed[moved_rank]) {
                continue;
            }
            if (node_count == node_capacity) {
                int next_capacity = node_capacity * 2;
                Node *grown;
                if (next_capacity > PERM_COUNT) {
                    next_capacity = PERM_COUNT;
                }
                if (node_count == next_capacity) {
                    continue;
                }
                grown = (Node *)realloc(nodes, (size_t)next_capacity * sizeof(Node));
                if (grown == NULL) {
                    continue;
                }
                nodes = grown;
                node = &nodes[current.index];
                node_capacity = next_capacity;
            }
            child = &nodes[node_count];
            memcpy(child->tile, moved, BOARD_N);
            child->parent = current.index;
            child->g = node->g + 1;
            item.f = child->g + manhattan(moved, goal_at);
            item.index = node_count;
            node_count++;
            heap_push(&heap, &heap_count, &heap_capacity, item);
        }
    }

done:
    free(closed);
    free(nodes);
    free(heap);
    return answer;
}

__attribute__((visibility("default")))
const char *a_star(const char *input_json) {
    Cursor cursor;
    uint8_t start[BOARD_N];
    uint8_t goal[BOARD_N];
    int rows = 0;
    int cols = 0;
    size_t length;
    if (input_json == NULL) {
        return "[\"BAD_JSON\"]";
    }
    length = strlen(input_json);
    cursor.p = input_json;
    cursor.end = input_json + length;
    skip_space(&cursor);
    if (cursor.p >= cursor.end || *cursor.p != '[') {
        return "[\"BAD_JSON\"]";
    }
    cursor.p++;
    if (!parse_board(&cursor, start)) {
        return "[\"BAD_JSON\"]";
    }
    skip_space(&cursor);
    if (cursor.p >= cursor.end || *cursor.p != ',') {
        return "[\"BAD_JSON\"]";
    }
    cursor.p++;
    if (!parse_board(&cursor, goal)) {
        return "[\"BAD_JSON\"]";
    }
    skip_space(&cursor);
    if (cursor.p >= cursor.end || *cursor.p != ',') {
        return "[\"BAD_JSON\"]";
    }
    cursor.p++;
    if (!parse_int(&cursor, &rows)) {
        return "[\"BAD_JSON\"]";
    }
    skip_space(&cursor);
    if (cursor.p >= cursor.end || *cursor.p != ',') {
        return "[\"BAD_JSON\"]";
    }
    cursor.p++;
    if (!parse_int(&cursor, &cols)) {
        return "[\"BAD_JSON\"]";
    }
    skip_space(&cursor);
    if (cursor.p >= cursor.end || *cursor.p != ']') {
        return "[\"BAD_JSON\"]";
    }
    cursor.p++;
    skip_space(&cursor);
    if (cursor.p != cursor.end) {
        return "[\"BAD_JSON\"]";
    }
    if (rows != 3 || cols != 3) {
        return "[\"UNSUPPORTED\"]";
    }
    if (!is_permutation(start) || !is_permutation(goal)) {
        return "[\"BAD_BOARD\"]";
    }
    return solve(start, goal);
}
