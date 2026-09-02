# V8.6 · 部件损伤与结构应力 设计规格

## 目标
把 V8.5.1 已存在的“方块独立耐久”升级成真正影响战斗状态的系统：关键部件在未完全摧毁前就会按剩余耐久逐级衰减；主梁剩余耐久参与结构应力，并在高应力下提高大型结构断裂概率；瞄准关键方块时显示当前 HP 和损伤状态。

## 全局约束
- 完全不加入进水，不创建 `leaks` / `flooding` / `draft` 或任何隐藏进水数值。
- 保留 V8.5.1 的破甲后穿透、方块独立耐久、火药舱摧毁爆炸、结构连通性断裂、残骸、水花。
- 保留 V8.4.2 的低频 2 发齐射、无镜头抖动、无船体受击后坐/横摇。
- 不增加新舰型、关卡、炮弹种类或登船战。
- 结构应力只影响结构失效，不重新引入整船攻击冲量。

## 1. 部件耐久阶段
关键类型：`cannon`、`mast`、`rudder`、`beam/core`、`powder`。

按 `hp / maxHp` 分级：
- `healthy`: > 0.66
- `damaged`: > 0.33 且 <= 0.66
- `critical`: > 0 且 <= 0.33
- `destroyed`: hp <= 0 或 alive=false

通用接口：
- `componentRatio(cell)` -> 0..1
- `componentStage(cell)` -> 上述字符串
- `shipSystemRatios(ship)` -> `{cannon,mast,rudder,beam,powder}`，每项按该类初始格总数计算剩余耐久比例，已摧毁格贡献 0。

## 2. 渐进性能衰减
### 桅杆
敌舰速度乘数：`0.75 + 0.25 * mastRatio`。
完整为 1.0，完全失效时与旧系统一致约 0.75。

### 舵机
敌舰速度/机动乘数：`0.55 + 0.45 * rudderRatio`。
完整为 1.0，完全失效时保持旧系统约 0.55；`rudderRatio < 0.33` 标记 `rudderCritical=true`，旧的轻微航向摆动仍可保留，但不得产生受击抖动。

### 炮位
`cannonEfficiency = 0.45 + 0.55 * cannonRatio`；若所有炮位摧毁则为 0。
敌舰射击倒计时每帧只按 `cannonEfficiency` 速度流逝，因此炮位越残，实际开火间隔越长；所有炮位摧毁继续完全停止射击。

### 火药舱
不在低 HP 时提前爆炸。仅暴露 `powderDanger`：
- healthy -> 0
- damaged -> 0.5
- critical -> 1
- destroyed -> 由现有火药爆炸逻辑处理

## 3. 主梁结构应力
`beamIntegrity` 取所有 `beam/core` 格子的剩余耐久总和 / 最大耐久总和。
`structureStress = 1 - beamIntegrity`。

结构应力阶段：
- `< 0.34`: stable
- `0.34..0.66`: strained
- `> 0.66`: critical

每个存活方块获得只用于结构/渲染的 `stress` 值：根据其到低耐久主梁的 Manhattan 距离衰减，不修改导航物理。

## 4. 高应力断裂
仍以现有 `detachDisconnectedComponents()` 为主，不替换连通性算法。

当 `beam/core` 方块被摧毁且 `structureStress >= 0.34` 时执行一次结构应力扩散：
- 扫描被毁主梁两格范围内的存活 hull/deck/beam/core。
- 对这些格子施加少量 `stressDamage`，强度随 `structureStress` 增加。
- 仅当目标本身已经处于 critical 耐久时，stressDamage 才允许把它压到 0；健康格不会被“一次结构应力”直接秒杀。
- 然后重新调用 `detachDisconnectedComponents()`；若形成 disconnected component，继续用现有 `createDebrisClusters()` 生成整块残骸。
- 追加局部 `stressRupture` FX；必须保持 `state.shake=0` 并清零船体攻击 motion。

这保证大块断裂来自“主梁长期被打残 + 最后连接点失败”，而不是随机秒断。

## 5. 瞄准信息
当 `state.aim` 指向仍存在的方块时，在准星附近显示：

`主梁 52 / 96 · 受损`

中文类型：
- hull 船壳
- deck 甲板
- beam/core 主梁
- powder 火药舱
- rudder 舵机
- mast 桅杆
- cannon 炮位

状态：完整 / 受损 / 危急 / 已毁。

对于关键部件额外显示简短效果：
- 炮位：`炮效 72%`
- 桅杆：`帆效 81%`
- 舵机：`舵效 65%`
- 主梁：`结构应力 48%`
- 火药舱 critical：`危险`

## 6. 视觉
- damaged/critical 关键部件在现有裂纹上增加局部小图标或短标签。
- `structureStress >= .34` 时，仅在受力区域画少量暗红/深褐结构应力线，不晃屏、不晃船。
- `stressRupture` 表现为局部裂纹扩张 + 木屑 + 短暂暗色断裂环；不使用全屏 shake。

## 7. 版本与入口
- 页面标题：`大航海时代 V8.6 · 部件损伤与结构应力`
- HUD：`V8.6 · 部件损伤与结构应力`
- 新模块：`js/v8/37_component_stress.js`
- V8 脚本缓存键统一 `?v=8.6.0`
- `legacy_v7.html` 不修改。

## 验收
1. 关键部件在 hp>0 时已有渐进性能变化。
2. 炮位受损会可测地降低开火频率；炮位全毁仍完全停火。
3. 桅杆/舵机受损会按剩余 HP 连续降低敌舰速度/机动能力。
4. 主梁低 HP 时 `structureStress` 上升；高应力主梁摧毁能触发 stress rupture 并可扩大 coherent debris cluster。
5. 准星能显示格子 HP、状态和关键系统信息。
6. 无 `leaks/flooding/draft`；无镜头抖动；无船体受击 recoil。
7. V8.6 专项、V8.5.1→V8.0 回归、JS syntax、V6/V7 legacy 全部通过。