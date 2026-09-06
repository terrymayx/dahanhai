# 大航海 · 海战 Demo

当前最新试玩版本：**持续航行·甲板守卫战**，并保留 **机动海战** 作为对照模式。

## 在线试玩

- GitHub Pages：<https://terrymayx.github.io/dahanhai/>
- 源码 ZIP 下载：<https://terrymayx.github.io/dahanhai/downloads/public_deck_guard_mode.zip>

默认进入“甲板守卫”模式；页面顶部可以切换到“机动海战”。

## 甲板守卫操作

- 点击敌船：选择舰炮目标
- 点击甲板敌人：指定优先集火
- 上舷 / 中央 / 下舷：调动预备队
- `Space`：舰炮齐射
- `R`：应急维修
- `P` / `Esc`：暂停
- `F2`：调试面板

## 机动海战操作

- `WASD` / 摇杆：移动
- 点击敌船：锁定目标
- `Q`：切换目标
- `1 / 2 / 3`：集火炮位 / 船帆 / 船体
- `Space`：齐射
- `E`：突进
- `R`：维修

## 最新源码包

`.deploy/source.part.*` 是最新完整源码 ZIP 的二进制分块。GitHub Pages 工作流会按顺序拼接这些分块、校验 SHA-256、解压并发布试玩版本，同时在 Pages 上提供完整 ZIP 下载。

源码包 SHA-256：

`18a5d7d6a514b814a652a3027f9bc19269498f1ff1a1b6bfa40e2bf3a750b09a`
