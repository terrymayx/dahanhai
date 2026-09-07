# 大航海 · 海战 Demo

当前在线试玩只发布最新版本：**持续航行·甲板守卫战 / 10倍人海 / 远程交火接近版**。

## 在线试玩

- GitHub Pages：<https://terrymayx.github.io/dahanhai/>
- 最新试玩源码 ZIP：<https://terrymayx.github.io/dahanhai/downloads/latest_deck_guard_demo.zip>
- 修改日志：[`CHANGELOG.md`](CHANGELOG.md)

线上页面不再加载旧版“机动海战”逻辑。

## 当前体验

- 我方保持120名可见战斗船员：60名射手 + 60名近战，其中20名为可调动预备队。
- 敌船从右侧较远位置逐步逼近，按“远程交火 → 减速闭合 → 靠舷调整 → 登船”进入战斗，不再高速贴脸。
- 双方存活射手会在甲板岗位附近轻量走动并进行真实箭矢/火枪交火。
- 预备队调往上舷、中央或下舷后会形成分散队形。
- 舰炮继续使用长装填、高伤害，负责击沉关键增援船或打断登船压力。

## 操作

- 点击敌船：选择舰炮目标
- 点击甲板敌人：指定优先集火
- 上舷 / 中央 / 下舷：调动20名预备近战
- `Space`：舰炮齐射
- `R`：应急维修
- `P` / `Esc`：暂停
- `F2`：调试面板

## 源码与发布方式

当前唯一在线维护源是仓库根目录的 `index.html`、`combat.js`、`guard.js`、`style.css` 与相关资源。

GitHub Pages 工作流直接检查并发布这些当前源码，不再在部署阶段运行旧补丁脚本，也不再由机器人重新修改并回推游戏源码。`latest_deck_guard_demo.zip` 与在线页面由同一次 Pages 构建生成，避免线上试玩与下载源码版本不一致。

当前专项回归：`tests/deck_guard_approach.test.js`。
