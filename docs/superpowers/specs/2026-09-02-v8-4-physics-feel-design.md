# V8.4 物理质感重构设计

## 目标

V8.4 不增加新的玩法系统，集中强化现有 V8.3 炮战的物理可信度和感观重量：炮弹更像重炮，船体更像有质量和惯性，断裂残骸更像真实落水并漂浮下沉，重大命中在镜头和特效上更有层级。

基调固定为：**真实基础 + 爽快强化**。所有反馈必须有物理依据，但允许适度夸张以提升移动端战斗爽感。

## 保留行为

V8.4 必须完整保留：

- 双舰编队与异型舰组合。
- 点击锁定目标与自动切换剩余舰。
- 4 发分时齐射。
- V8.3 的局部瞄准。
- 材料穿透。
- 火药舱连锁爆炸。
- 主梁/结构断裂。
- 整块残骸 cluster。
- 玩家高弧线、敌方低弧线的抛物线炮弹。
- 同时最多 2 艘 active 敌舰。
- 暂不加入甲板近战。

## 设计原则

1. **先物理，后特效**：镜头震动、碎片、水花都必须由命中强度、材料、冲量或断裂事件驱动，不能无条件播放大反馈。
2. **保持二维命中稳定性**：炮弹的 X/Y 精准瞄准和格子穿透逻辑不改为真正 3D 碰撞，Z 高度继续用于视觉与落弹感，避免破坏现有可控性。
3. **大船更重、小船更活**：舰型质量、横摇、冲量响应和尾流要区分。
4. **重大事件明显高于普通命中**：火药舱、主梁断裂、大块脱落必须显著强于普通 hull/deck 命中。
5. **控制移动端对象数量**：水花、烟尘、泡沫、碎片采用轻量数据对象和有上限的生命周期，不创建逐格 Node/Sprite。

## 一、船体整体动力学

### 新增船体瞬时物理状态

每艘船增加以下纯数据字段：

```js
physics:{
  impulseX:0,
  impulseY:0,
  angularVelocity:0,
  offsetX:0,
  offsetY:0,
  roll:0,
  bobPhase:0,
  mass:1,
  damping:0.86
}
```

`offsetX/offsetY/roll` 是短时受力姿态，不改变逻辑世界中的 `ship.x/ship.y/rotation` 主导航轨迹。这样不会影响当前点击瞄准、格子坐标和编队逻辑。

### 舰型质量

- sloop: `mass = 0.75`
- gunship: `mass = 1.0`
- manowar: `mass = 1.35`
- player: `mass = 1.45`

相同冲量下，小船位移/横摇更明显，大船反应更慢但惯性感更强。

### 命中冲量

普通炮弹命中时，根据炮弹 X/Y 速度方向计算单位向量：

```js
ux = vx / speed
uy = vy / speed
```

基础冲量按材料分级：

- deck: 2.2
- hull: 3.2
- mast/cannon/rudder: 3.8
- beam/core: 5.2
- powder 爆炸：额外 9.0 径向冲量

实际位移响应除以 `ship.physics.mass`。

扭矩由命中点相对船体中心的局部坐标产生：离船体中心越远，`angularVelocity` 越明显。角速度必须限幅，避免船体持续乱转。

### 受力衰减

每帧更新：

- `impulseX/Y` 指数衰减。
- `offsetX/Y` 向 0 回弹。
- `angularVelocity` 带阻尼。
- `roll` 带弹簧回正。

受击后的整体视觉偏移建议控制在：

- 普通命中：2–5 px
- beam 重击：4–8 px
- powder/大结构断裂：8–14 px

横摇角度：

- 普通命中：0.5–1.5°
- 重击：1.5–3°
- 爆炸/大断裂：最多约 5°

## 二、海面浮动与航行质感

### 船体浮动

所有 active 船只增加不影响逻辑坐标的轻微浮动：

```js
bobY = sin(time * bobFreq + bobPhase) * bobAmp
bobRoll = sin(time * rollFreq + bobPhase * 0.7) * rollAmp
```

建议：

- sloop: bob 3.5px，频率偏快。
- gunship: bob 2.8px。
- manowar/player: bob 2.0–2.4px，频率偏慢。
- 常态 roll 不超过约 1°。

命中产生的 `roll` 与常态 `bobRoll` 叠加。

### 尾流

尾流由船型和当前速度决定：

- 小船更细、更长。
- gunship 中等宽度。
- manowar/player 更宽、更厚，白沫更明显。
- 舵机/桅杆受损导致速度下降后，尾流强度同步下降。

尾流仍使用 Canvas 轻量几何绘制，不引入粒子系统依赖。

## 三、炮弹重量感

### 保留现有 X/Y 命中

`20_projectiles.js` 继续沿 X/Y 线段检测格子命中，不改成 Z 参与碰撞。

### 自适应弧高

新增按飞行距离修正的弧高：

玩家炮弹：

```text
arcHeight = clamp(140 + distance * 0.055, 145, 205)
```

敌方炮弹：

```text
arcHeight = clamp(85 + distance * 0.035, 90, 135)
```

4 发齐射仍允许在该基础值上做 ±12px 的微差，保持弹道层次。

### 落弹加速感

不改变数学落点，但 Renderer 根据 `vz`：

- 上升阶段尾迹较长、亮度稍低。
- 下降阶段炮弹尺寸和亮边轻微增强。
- 高速下落时尾迹缩短，形成“砸下去”的感觉。

### 炮弹烟迹

炮弹新增轻量 trail 采样：每隔约 0.045–0.06 秒记录一个短寿命烟点。

每颗炮弹最多保留约 8 个 trail 点；全局 trail 对象设置合理上限，超出时丢弃最旧数据。

烟迹透明度随时间快速下降，不能形成长时间遮挡。

## 四、命中材质反馈分级

### 轻命中

适用：deck、低损伤 hull。

- 小木屑。
- 黄色短闪。
- 极弱或无镜头震动。
- 不触发明显 hit-stop。

### 中命中

适用：hull 被击毁、mast/cannon/rudder 破坏。

- 中量木屑/金属暗色碎屑。
- 3–5px 级镜头震动。
- 约 0.025–0.04s hit-stop。
- 船体有明显受力位移和横摇。

### 重命中

适用：beam/core 被毁、大结构脱落。

- 结构爆裂环。
- 大量木屑。
- 5–8px 镜头震动。
- 约 0.045–0.06s hit-stop。
- 船体冲量和扭矩显著增加。

### 爆炸级

适用：powderBlast。

- 现有橙黄爆炸保留并增强分层。
- 增加中心亮核、外扩冲击环、少量深色烟尘。
- 8–12px 镜头震动。
- hit-stop 最大 0.075s。
- 对船体施加径向整体冲量。

## 五、残骸动力学与水感

### 残骸创建

`debrisCluster` 创建时必须继承：

- 母船当前导航速度的部分分量。
- 母船当前受击 `impulseX/Y` 的部分分量。
- 根据断裂位置施加额外向外速度。
- 根据离船体中心的位置产生合理 `angularVelocity`。

### 三阶段生命周期

#### 1. 断裂抛离阶段

前约 0.35–0.55s：

- 速度较明显。
- 保持整体形状。
- 旋转较快。

#### 2. 漂浮阶段

约 0.6–1.5s：

- 水平速度明显阻尼。
- 上下轻微 bob。
- 角速度衰减。
- 水面出现环形/椭圆波纹。

#### 3. 进水下沉阶段

剩余生命周期：

- `sinkProgress` 加速增加。
- 位置逐步下压。
- 透明度降低。
- 波纹减弱。
- 最终从数组移除。

大块残骸比小块沉得慢；cluster cell 数量参与 `life` 与阻尼计算。

## 六、水花、波纹和泡沫

新增轻量 FX 类型：

- `waterSplash`：炮弹或残骸落水瞬间水柱/白沫。
- `waterRing`：扩散椭圆波纹。
- `foam`：短寿命白色泡沫。

### 炮弹落水

如果炮弹未命中船体，并在其弧线生命周期结束附近仍存活，则在其 X/Y 当前位置触发：

- 小型 `waterSplash`
- 一个 `waterRing`
- 2–4 个轻量 `foam`

随后炮弹销毁。

### 残骸入水

cluster 第一次进入漂浮阶段时触发一次较大的 `waterSplash` 与 `waterRing`，只触发一次。

## 七、镜头反馈分级

保留现有 `state.shake` 和 `state.hitStop`，但统一改为事件等级驱动：

- light: shake 0–2，hitStop 0
- medium: shake 3–5，hitStop 0.025–0.04
- heavy: shake 6–8，hitStop 0.045–0.06
- critical: shake 9–12，hitStop 最大 0.075

Renderer 的世界层继续震动，HUD 不震动。

震动必须快速衰减，不允许长时间持续。

## 八、事件接口

Battle 层新增轻量反馈事件接口，先用于内部视觉统一，未来可无缝接声音：

```js
emitCombatEvent(state, type, payload)
```

首批 type：

- `impact_light`
- `impact_medium`
- `impact_heavy`
- `beam_break`
- `powder_blast`
- `debris_splash`
- `projectile_splash`

V8.4 不接真实音频资源，仅预留事件，不增加声音文件。

## 九、文件边界

### `js/v8/10_ship_grid.js`

- 保持现有格子结构与材料阻力。
- 新增可选的材质反馈/冲量系数表，或导出一个纯数据查询函数。
- 不重写 connectivity / penetration API。

### `js/v8/20_projectiles.js`

- 自适应弧高。
- trail 数据。
- 落水检测与 splash 事件。
- 保持 X/Y 格子命中和现有穿透语义。

### `js/v8/30_battle.js`

- 船体 physics 状态初始化与更新。
- 命中冲量和扭矩。
- 事件等级和统一反馈。
- debrisCluster 三阶段动力学。
- 水花/波纹 FX 生命周期。

### `js/v8/40_render.js`

- ship bob + roll + impulse offset。
- 按 vz 调整炮弹表现。
- trail 渲染。
- waterSplash / waterRing / foam。
- 更符合速度和舰型的尾流。
- debrisCluster 漂浮/下沉表现。

### `js/v8/50_input_loop.js`

- 不新增复杂控制。
- 保持现有点击锁定和局部瞄准。

## 十、性能约束

- 不创建逐方块 DOM/Node/Sprite。
- 炮弹 trail 使用固定短寿命数据，单弹最多约 8 点。
- `state.fx` 和水面 FX 设上限，优先删除最旧、最轻反馈。
- debrisCluster 仍一块结构一个对象，不拆成每格独立物理体。
- 移动端 DPR 上限继续保持现有设置。

## 十一、测试计划

新增至少以下合同测试：

### `tests/v8_4_ship_impulse.test.js`

- 不同舰型 mass 不同。
- 命中会改变 ship physics impulse/roll。
- beam 命中反馈强于 deck。
- physics 在无新命中时会衰减回零附近。

### `tests/v8_4_ballistic_feel.test.js`

- 玩家远距离弧高高于近距离。
- 敌方弧高低于玩家。
- trail 采样有上限。
- 未命中炮弹弧线结束后触发 projectile splash 并销毁。

### `tests/v8_4_debris_water.test.js`

- cluster 继承母船速度/冲量。
- cluster 有 airborne/float/sink 三阶段。
- 入水 splash 仅触发一次。
- 大 cluster 生命周期长于小 cluster。

### `tests/v8_4_feedback_levels.test.js`

- deck/hull/beam/powder 映射到不同反馈等级。
- shake/hitStop 不超过 V8.4 上限。
- critical 高于 medium。

### `tests/v8_4_render_contract.test.js`

- Renderer 使用 physics offset/roll/bob。
- 绘制 projectile trail。
- 绘制 waterSplash/waterRing/foam。
- HUD 标识 `V8.4 · 物理质感重构`。

同时必须重新运行：

- 所有 `tests/v8_3*.test.js`
- 所有 `tests/v8_2*.test.js`
- 所有 `tests/v8_1*.test.js`
- 所有 `tests/v8_0*.test.js`
- `node --check js/v8/*.js`
- legacy V6/V7 回归

## 十二、发布

- 首页标题升级为：`大航海时代 V8.4 · 物理质感重构`
- HUD 标识：`V8.4 · 物理质感重构`
- 所有 `js/v8/*.js` cache key 升级到 `?v=8.4.0`
- `legacy_v7.html` 保持不变。
- 最终 GitHub Pages 必须对最终 main SHA 部署成功。

## 验收标准

玩家在不看数值的情况下，应能直接感受到：

1. 同一发重炮打在小船和大船上，整体晃动幅度不同。
2. 打船中央和打船头/船尾时，横摇和扭矩不同。
3. 普通 deck 命中明显弱于 beam 断裂和 powder 爆炸。
4. 炮弹远距离时弧线更高，落弹更有下砸感。
5. 未命中炮弹落海有水花和波纹，不再无声消失。
6. 大块残骸断裂后会抛离、漂浮、产生水花，再逐渐进水下沉。
7. 船在没有受击时也有轻微、克制的海面浮动。
8. 所有新增反馈不破坏 V8.3 的锁定、齐射、穿透、双舰编队和结构破坏。
