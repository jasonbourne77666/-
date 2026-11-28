cmake_minimum_required(VERSION 3.18)
project(pkg C)

add_library(pkg SHARED src/a_star.c)
target_include_directories(pkg PRIVATE src)
target_compile_options(pkg PRIVATE -Wall -Wextra -Werror -O2 -fvisibility=hidden)
set_target_properties(pkg PROPERTIES
    C_VISIBILITY_PRESET hidden
    OUTPUT_NAME "pkg")
