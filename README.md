# 大航海 · 海战 Demo

当前在线试玩只发布最新版本：**持续航行·甲板守卫战**。

## 在线试玩

- GitHub Pages：<https://terrymayx.github.io/dahanhai/>
- 最新试玩源码 ZIP：<https://terrymayx.github.io/dahanhai/downloads/latest_deck_guard_demo.zip>

线上页面不再提供旧版“机动海战”入口。

## 操作

- 点击敌船：选择舰炮目标
- 点击甲板敌人：指定优先集火
- 上舷 / 中央 / 下舷：调动预备队
- `Space`：舰炮齐射
- `R`：应急维修
- `P` / `Esc`：暂停
- `F2`：调试面板

## 发布方式

`.deploy/source.part.*` 保存最新完整源码包。GitHub Pages 工作流会重建源码、移除旧版在线入口，只发布最新“甲板守卫”试玩，并把同一份最新试玩同步到仓库根目录，避免旧版 Pages 构建覆盖新版。

源包 SHA-256：

`18a5d7d6a514b814a652a3027f9bc19269498f1ff1a1b6bfa40e2bf3a750b09a`
