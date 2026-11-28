#include "a_star.h"

#include <stdio.h>
#include <string.h>

static int g_failed = 0;

static void expect(const char *name, const char *input, const char *want) {
    const char *got = a_star(input);
    if (strcmp(got, want) != 0) {
        fprintf(stderr, "FAIL %s\n  input: %s\n  want:  %s\n  got:   %s\n", name, input, want, got);
        g_failed++;
    } else {
        printf("ok %s\n", name);
    }
}

static int blank_index(const char *board) {
    int index = 0;
    const char *cursor = board;
    while (*cursor && *cursor != ']') {
        if (*cursor == '0' && (cursor == board || cursor[-1] == ',' || cursor[-1] == '[')) {
            return index;
        }
        if (*cursor == ',') {
            index++;
        }
        cursor++;
    }
    return -1;
}

/* 每一步都必须是空格与上下左右相邻格交换，最后一盘等于目标。 */
static void expect_legal_path(const char *name, const char *input) {
    const char *got = a_star(input);
    const char *cursor;
    char previous[32];
    int states = 0;
    int previous_blank = -1;
    if (got[0] != '[') {
        fprintf(stderr, "FAIL %s got %s\n", name, got);
        g_failed++;
        return;
    }
    if (got[1] == '"') {
        fprintf(stderr, "FAIL %s unexpected error %s\n", name, got);
        g_failed++;
        return;
    }
    cursor = got + 1;
    previous[0] = '\0';
    while (*cursor) {
        char board[32];
        int length = 0;
        int blank;
        if (*cursor != '[') {
            break;
        }
        while (cursor[length] && cursor[length] != ']') {
            length++;
        }
        length++;
        if (length >= (int)sizeof(board)) {
            fprintf(stderr, "FAIL %s board too long\n", name);
            g_failed++;
            return;
        }
        memcpy(board, cursor, (size_t)length);
        board[length] = '\0';
        blank = blank_index(board);
        if (states > 0) {
            int distance = blank - previous_blank;
            if (distance < 0) {
                distance = -distance;
            }
            if (!((distance == 1) || (distance == 3))) {
                fprintf(stderr, "FAIL %s illegal step %s -> %s\n", name, previous, board);
                g_failed++;
                return;
            }
        }
        memcpy(previous, board, (size_t)length + 1);
        previous_blank = blank;
        states++;
        cursor += length;
        if (*cursor == ',') {
            cursor++;
        }
    }
    if (strcmp(previous, "[1,2,3,4,5,6,7,8,0]") != 0) {
        fprintf(stderr, "FAIL %s final %s\n", name, previous);
        g_failed++;
        return;
    }
    printf("ok %s states=%d\n", name, states);
}

int main(void) {
    expect(
        "solved",
        "[[1,2,3,4,5,6,7,8,0],[1,2,3,4,5,6,7,8,0],3,3]",
        "[[1,2,3,4,5,6,7,8,0]]");
    expect(
        "one-move",
        "[[1,2,3,4,5,6,7,0,8],[1,2,3,4,5,6,7,8,0],3,3]",
        "[[1,2,3,4,5,6,7,0,8],[1,2,3,4,5,6,7,8,0]]");
    expect(
        "unsolvable",
        "[[2,1,3,4,5,6,7,8,0],[1,2,3,4,5,6,7,8,0],3,3]",
        "[\"UNSOLVABLE\"]");
    expect("bad-json", "[]", "[\"BAD_JSON\"]");
    expect("bad-board", "[[1,1,1,1,1,1,1,1,1],[1,2,3,4,5,6,7,8,0],3,3]", "[\"BAD_BOARD\"]");
    expect("size", "[[1,2,3,4,5,6,7,8,0],[1,2,3,4,5,6,7,8,0],4,4]", "[\"UNSUPPORTED\"]");
    expect_legal_path(
        "scramble",
        "[[2,0,3,1,5,6,4,7,8],[1,2,3,4,5,6,7,8,0],3,3]");
    expect_legal_path(
        "hard",
        "[[8,6,7,2,5,4,3,0,1],[1,2,3,4,5,6,7,8,0],3,3]");
    if (g_failed) {
        fprintf(stderr, "%d failed\n", g_failed);
        return 1;
    }
    printf("all passed\n");
    return 0;
}
