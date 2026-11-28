cmake_minimum_required(VERSION 3.18)
project(linglongso CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(linglong SHARED liblinglong_decompiled.cpp)
add_library(mhxy_vision SHARED libmhxy_vision_decompiled.cpp)

foreach(target linglong mhxy_vision)
  target_compile_options(${target} PRIVATE -O2 -Wall -Wextra)
  set_target_properties(${target} PROPERTIES
    CXX_VISIBILITY_PRESET default
    VISIBILITY_INLINES_HIDDEN OFF)
endforeach()
