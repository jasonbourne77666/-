#!/usr/bin/env python3
# 从地图图片生成和 脚本/封妖地图数据.lua 相同结构的一张地图。
# 网格按格子取样：暗像素算走不过，写成 "0"；其余写成 "1"。
# 寻路里格子 y=0 在小地图底部，所以默认把图片最下面一行放进网格第一条。

import argparse
import struct
import sys
import zlib
from pathlib import Path


def 解析整数串(文本):
    if not 文本:
        return None
    段 = [项.strip() for 项 in 文本.split(",")]
    if any(not 项 for 项 in 段):
        raise SystemExit("数字列表里有空项: " + 文本)
    return [int(项) for 项 in 段]


def 解析颜色(文本):
    if not 文本:
        return None
    值 = 解析整数串(文本)
    if len(值) != 3 or any(项 < 0 or 项 > 255 for 项 in 值):
        raise SystemExit("颜色要写成 R,G,B，每项 0 到 255: " + 文本)
    return tuple(值)


def 帕斯(左, 上, 左上):
    估计 = 左 + 上 - 左上
    距左 = abs(估计 - 左)
    距上 = abs(估计 - 上)
    距左上 = abs(估计 - 左上)
    if 距左 <= 距上 and 距左 <= 距左上:
        return 左
    if 距上 <= 距左上:
        return 上
    return 左上


def 读png(数据):
    if 数据[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("只支持 PNG")
    位置 = 8
    宽 = 高 = 位深 = 色型 = None
    数据块 = []
    while 位置 < len(数据):
        长度 = struct.unpack(">I", 数据[位置:位置 + 4])[0]
        类型 = 数据[位置 + 4:位置 + 8]
        内容 = 数据[位置 + 8:位置 + 8 + 长度]
        位置 += 12 + 长度
        if 类型 == b"IHDR":
            宽, 高, 位深, 色型, 压缩, 过滤, 隔行 = struct.unpack(">IIBBBBB", 内容)
            if 压缩 or 过滤 or 隔行 or 位深 != 8 or 色型 not in (0, 2, 6):
                raise SystemExit("请导出 8 位、不隔行的 PNG，灰阶、RGB 或带透明都可以")
        elif 类型 == b"IDAT":
            数据块.append(内容)
        elif 类型 == b"IEND":
            break
    if 宽 is None or not 数据块:
        raise SystemExit("PNG 缺少图像数据")
    原始 = zlib.decompress(b"".join(数据块))
    通道 = {0: 1, 2: 3, 6: 4}[色型]
    行宽 = 宽 * 通道
    行集 = []
    游标 = 0
    上一行 = bytearray(行宽)
    for _ in range(高):
        过滤方式 = 原始[游标]
        游标 += 1
        扫描 = 原始[游标:游标 + 行宽]
        游标 += 行宽
        行 = bytearray(行宽)
        if 过滤方式 == 0:
            行[:] = 扫描
        elif 过滤方式 == 1:
            for 下标 in range(行宽):
                左 = 行[下标 - 通道] if 下标 >= 通道 else 0
                行[下标] = (扫描[下标] + 左) & 255
        elif 过滤方式 == 2:
            for 下标 in range(行宽):
                行[下标] = (扫描[下标] + 上一行[下标]) & 255
        elif 过滤方式 == 3:
            for 下标 in range(行宽):
                左 = 行[下标 - 通道] if 下标 >= 通道 else 0
                行[下标] = (扫描[下标] + ((左 + 上一行[下标]) // 2)) & 255
        elif 过滤方式 == 4:
            for 下标 in range(行宽):
                左 = 行[下标 - 通道] if 下标 >= 通道 else 0
                左上 = 上一行[下标 - 通道] if 下标 >= 通道 else 0
                行[下标] = (扫描[下标] + 帕斯(左, 上一行[下标], 左上)) & 255
        else:
            raise SystemExit("不认识的 PNG 行过滤 %d" % 过滤方式)
        上一行 = 行
        行集.append(行)
    if 游标 != len(原始):
        raise SystemExit("PNG 像素数据和尺寸对不上")
    return 宽, 高, 通道, 行集


def 写png(宽, 高, 填色):
    # 填色(横坐标, 纵坐标) 返回 R,G,B。只给自测用。
    原始 = bytearray()
    for 纵 in range(高):
        原始.append(0)
        for 横 in range(宽):
            红, 绿, 蓝 = 填色(横, 纵)
            原始.extend((红, 绿, 蓝))
    压缩 = zlib.compress(bytes(原始))

    def 块(类型, 内容):
        return struct.pack(">I", len(内容)) + 类型 + 内容 + struct.pack(">I", zlib.crc32(类型 + 内容) & 0xFFFFFFFF)

    头 = struct.pack(">IIBBBBB", 宽, 高, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + 块(b"IHDR", 头) + 块(b"IDAT", 压缩) + 块(b"IEND", b"")


def 亮度(像素):
    红, 绿, 蓝 = 像素
    return 0.299 * 红 + 0.587 * 绿 + 0.114 * 蓝


def 取点(行, 通道, 横坐标):
    起点 = 横坐标 * 通道
    if 通道 == 1:
        灰 = 行[起点]
        return 灰, 灰, 灰
    return 行[起点], 行[起点 + 1], 行[起点 + 2]


def 接近(像素, 颜色, 容差):
    return all(abs(像素[序号] - 颜色[序号]) <= 容差 for 序号 in range(3))


def 读格子(图片, 格像素, 暗阈值, 阻挡比例, 路点色, 路点容差, 纵轴向上):
    宽像素, 高像素, 通道, 行集 = 图片
    if 宽像素 % 格像素 or 高像素 % 格像素:
        raise SystemExit("图片尺寸 %d×%d 不能被格像素 %d 整除" % (宽像素, 高像素, 格像素))
    宽 = 宽像素 // 格像素
    高 = 高像素 // 格像素
    自上而下 = []
    路点 = []
    for 图行 in range(高):
        行字 = []
        for 图列 in range(宽):
            暗数 = 0
            有路点 = False
            左 = 图列 * 格像素
            上 = 图行 * 格像素
            for 纵 in range(上, 上 + 格像素):
                行 = 行集[纵]
                for 横 in range(左, 左 + 格像素):
                    点 = 取点(行, 通道, 横)
                    if 路点色 is not None and 接近(点, 路点色, 路点容差):
                        有路点 = True
                        continue
                    if 亮度(点) <= 暗阈值:
                        暗数 += 1
            if 暗数 / (格像素 * 格像素) >= 阻挡比例:
                行字.append("0")
            else:
                行字.append("1")
            if 有路点:
                路点.append((图列, 图行))
        自上而下.append("".join(行字))
    if 纵轴向上:
        网格 = list(reversed(自上而下))
        路点 = [(横坐标, 高 - 1 - 图行) for 横坐标, 图行 in 路点]
    else:
        网格 = 自上而下
    if any(len(行) != 宽 for 行 in 网格) or len(网格) != 高:
        raise SystemExit("网格尺寸和图片对不上")
    return 宽, 高, 网格, 路点


def lua字符串(文本):
    return '"' + 文本.replace("\\", "\\\\").replace('"', '\\"') + '"'


def 写成一张(名字, 编号, 宽, 高, 格像素, 贴图, 关闭, 路点, 网格):
    行 = []
    行.append("  [%s] = {" % lua字符串(名字))
    行.append('    ["编号"] = %d,' % 编号)
    行.append('    ["宽"] = %d,' % 宽)
    行.append('    ["高"] = %d,' % 高)
    行.append('    ["像素宽"] = %d,' % (宽 * 格像素))
    行.append('    ["像素高"] = %d,' % (高 * 格像素))
    if 贴图:
        行.append('    ["贴图"] = {%s},' % ", ".join(str(项) for 项 in 贴图))
    if 关闭:
        行.append('    ["关闭"] = {%s},' % ", ".join(str(项) for 项 in 关闭))
    if 路点:
        行.append('    ["巡游点"] = {')
        for 横坐标, 纵坐标 in 路点:
            行.append("      {%d, %d}," % (横坐标, 纵坐标))
        行.append("    },")
    行.append('    ["网格"] = {')
    for 网格行 in 网格:
        行.append("      %s," % lua字符串(网格行))
    行.append("    },")
    行.append("  },")
    return "\n".join(行)


def 自测():
    def 填色(横, 纵):
        if 横 < 20 and 纵 < 20 and 横 == 5 and 纵 == 5:
            return 255, 0, 0
        if 纵 < 20 and 横 >= 20:
            return 0, 0, 0
        if 纵 >= 20 and 横 < 20:
            return 0, 0, 0
        return 255, 255, 255

    图片 = 读png(写png(40, 40, 填色))
    宽, 高, 网格, 路点 = 读格子(图片, 20, 40, 0.5, (255, 0, 0), 30, True)
    if (宽, 高) != (2, 2):
        raise SystemExit("自测尺寸不对 %s %s" % (宽, 高))
    # 图片上方是北。上方右格是黑的，下方左格是黑的。y=0 在底部。
    if 网格 != ["01", "10"]:
        raise SystemExit("自测网格不对 %s" % (网格,))
    if 路点 != [(0, 1)]:
        raise SystemExit("自测路点不对 %s" % (路点,))
    文本 = 写成一张("测试", 1, 宽, 高, 20, [1, 2, 3, 4], [5, 6], 路点, 网格)
    if '["网格"]' not in 文本 or '"01"' not in 文本 or '"10"' not in 文本:
        raise SystemExit("自测输出缺字段")
    print("SELF_TEST_OK")


def main():
    if "--self-test" in sys.argv:
        自测()
        return
    参数 = argparse.ArgumentParser(
        description="按格子读取地图 PNG，生成封妖地图数据。暗格写成 0，亮格写成 1。"
    )
    参数.add_argument("图片", type=Path, help="地图 PNG。宽高都要能被格像素整除，默认 20 像素一格")
    参数.add_argument("--name", required=True, help="地图名，例如 麒麟山")
    参数.add_argument("--id", required=True, type=int, help="地图编号，例如 1210")
    参数.add_argument("--tile", type=int, default=20, help="一格多少像素，默认 20")
    参数.add_argument("--dark", type=int, default=40, help="亮度不超过这个值算阻挡，默认 40")
    参数.add_argument("--ratio", type=float, default=0.5, help="一格里阻挡像素达到这个比例就写成 0，默认 0.5")
    参数.add_argument("--y-origin", choices=("bottom", "top"), default="bottom", help="图片哪一头是格子 y=0。寻路里 y=0 在小地图底部，默认 bottom")
    参数.add_argument("--texture", help="小地图在屏幕上的左,上,像素宽,像素高。地图图片里量不出来")
    参数.add_argument("--close", help="关闭按钮中心的屏幕横坐标,纵坐标。地图图片里量不出来")
    参数.add_argument("--patrol-color", help="路点标记颜色 R,G,B。格子里出现这种颜色就记一个巡游点")
    参数.add_argument("--patrol-tolerance", type=int, default=30, help="路点颜色容差，默认 30")
    参数.add_argument("--full", action="store_true", help="外包一层 return { }")
    参数.add_argument("--output", type=Path, help="写到文件。不写就打印到标准输出")
    选项 = 参数.parse_args()
    if 选项.tile < 1:
        raise SystemExit("格像素至少是 1")
    if not 0 < 选项.ratio <= 1:
        raise SystemExit("阻挡比例要在 0 到 1 之间")
    贴图 = 解析整数串(选项.texture)
    if 贴图 is not None and len(贴图) != 4:
        raise SystemExit("贴图要 4 个数: 左,上,像素宽,像素高")
    关闭 = 解析整数串(选项.close)
    if 关闭 is not None and len(关闭) != 2:
        raise SystemExit("关闭要 2 个数: 横坐标,纵坐标")
    路点色 = 解析颜色(选项.patrol_color)
    图片 = 读png(选项.图片.read_bytes())
    宽, 高, 网格, 路点 = 读格子(
        图片,
        选项.tile,
        选项.dark,
        选项.ratio,
        路点色,
        选项.patrol_tolerance,
        选项.y_origin == "bottom",
    )
    正文 = 写成一张(选项.name, 选项.id, 宽, 高, 选项.tile, 贴图, 关闭, 路点, 网格)
    if 选项.full:
        正文 = "return {\n" + 正文 + "\n}\n"
    else:
        正文 += "\n"
    if 选项.output:
        选项.output.write_bytes(正文.replace("\n", "\r\n").encode("utf-8"))
    else:
        sys.stdout.write(正文)
    阻挡 = sum(行.count("0") for 行 in 网格)
    sys.stderr.write("%s %d×%d 格，阻挡 %d，路点 %d\n" % (选项.name, 宽, 高, 阻挡, len(路点)))


if __name__ == "__main__":
    main()
