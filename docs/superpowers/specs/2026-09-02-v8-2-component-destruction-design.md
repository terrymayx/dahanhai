# V8.2 部位破坏与连锁毁伤设计

## 目标

V8.2 在 V8.1“点击局部瞄准 + 有限穿透 + 结构断裂”的基础上，把方块船从纯几何破坏升级为有功能意义的结构破坏。

玩家应该能够通过观察和瞄准明确理解：

- 打船壳是在开洞；
- 打主梁是在削弱结构连接；
- 打火药舱会产生连锁爆炸；
- 打舵机/桅杆会影响敌舰机动；
- 打断结构后，脱落区域会作为整块残骸继续存在一段时间，而不是瞬间消失。

V8.2 仍保持场上最多 1 艘 active 敌舰；不接回甲板战。

## 方案选择

采用“扩展现有 js/v8 核心”的方案，不新增 legacy wrapper。

现有层次继续保持：

- `10_ship_grid.js`：船体模板、cell 类型、材料、连通性、功能部位；
- `20_projectiles.js`：材料穿透与连续命中；
- `30_battle.js`：部位破坏后果、连锁爆炸、功能失效、残骸 cluster 生命周期；
- `40_render.js`：部位辨识、爆炸、整块残骸、水花；
- `50_input_loop.js`：继续使用 V8.1 局部点击瞄准，不增加新的复杂输入模式。

## 1. 方块类型与材料

V8.2 最小类型集合：

- `hull`：外壳，HP 28，穿透阻力 34；
- `deck`：甲板，HP 20，穿透阻力 24；
- `beam`：主梁/龙骨结构，HP 48，穿透阻力 52，结构权重高；
- `powder`：火药舱，HP 18，穿透阻力 20；
- `rudder`：舵机，HP 24，穿透阻力 28；
- `mast`：桅杆根部，HP 26，穿透阻力 30；
- `cannon`：炮位，HP 26，穿透阻力 30。

旧 `core` 在 V8.2 中收敛为 `beam` 语义；为了兼容历史测试，可保留 `core` 作为别名或只在兼容路径中存在，但新模板优先生成 `beam`。

每个 cell 新增可选字段：

```js
{
  type,
  material,
  hp,
  maxHp,
  weight,
  critical,
  system
}
```

其中 `system` 可为 `powder` / `rudder` / `mast` / `cannon` / `structure`。

## 2. 部位布局

敌舰模板中功能部位使用确定性规则生成，保证每艘同类型船都有可学习的弱点位置。

第一版规则：

- `beam`：沿船体纵向中心线放置连续主结构；
- `powder`：船体中后部内部 1~2 格，绝不直接暴露在最外层；
- `rudder`：船尾内部 1 格；
- `mast`：船体中部内部 1~2 格；
- `cannon`：中部靠两侧但不位于最外层的若干格。

功能部位只替换原有 occupancy 内的格子，不改变船体外轮廓。

## 3. 材料穿透

玩家炮弹继续拥有 `penetration`，但 V8.2 的穿透消耗由 cell 材料决定。

命中流程：

1. 找到弹道上的第一个未命中过的存活 cell；
2. 对 cell 造成伤害；
3. 从 projectile.penetration 扣除该 cell 的材料阻力；
4. penetration > 0 时，炮弹沿原方向推进到该格后方继续飞行；
5. penetration <= 0 时，炮弹销毁。

穿透不要求当前格必须被击毁才继续；但主梁等高阻力材料会大幅降低继续深入的能力。

敌方炮弹暂时保持 V8.1 行为：命中一格后停止。

## 4. 火药舱连锁爆炸

当 `powder` cell 被摧毁：

- 触发一次 `powderBlast`；
- 对中心周围半径 2 格内的存活 cell 造成衰减伤害；
- 最近一圈高伤害，第二圈较低伤害；
- 连锁伤害可以继续摧毁 cell，但同一个 powder 在一次爆炸中只能触发一次，防止递归爆炸死循环；
- 爆炸结束后统一运行一次结构连通性检查。

视觉：

- 比普通结构断裂更大的橙黄色爆炸；
- 更强 shake；
- 0.07 秒以内 hit-stop；
- 大量木屑和火星。

## 5. 功能损伤

### Rudder

`rudder` 被摧毁后：

- 敌舰基础速度乘以 0.55；
- 轻微持续摇摆/偏航只做视觉，不引入复杂航海物理。

### Mast

`mast` 被摧毁后：

- 敌舰速度再乘以 0.75；
- 可叠加 rudder 效果，但设最低速度下限，避免完全静止。

### Cannon

V8.2 暂时只做视觉与状态标记。敌舰现有远程炮击若对应 cannon 全毁，可停止射击；不建立复杂左右舷炮位系统。

### Beam

`beam` 本身不直接扣整船百分比之外的新血条，但高 `weight` 会显著影响结构完整度；同时 beam 断裂更容易把船体切成多个连通区域。

## 6. 结构断裂与整块残骸

V8.1 的 `detachDisconnected()` 会直接把失联 cell 标记为 dead 并逐格生成 debris。

V8.2 改为：

1. 先计算所有与主结构不连通的 connected components；
2. 每一个 component 生成一个 `debrisCluster`；
3. cluster 保存原始 cell 相对坐标、颜色/type、整体中心点；
4. 原船上的这些 cell 标记为 dead；
5. cluster 作为整体拥有：
   - x/y
   - vx/vy
   - rotation
   - angularVelocity
   - life
   - sinkProgress
6. cluster 先漂移/旋转，再逐步下沉并淡出。

Renderer 按 cluster 内原 cell 相对位置整块绘制，所以残骸保持原来的断裂形状。

小于 2 格的 component 可以继续走普通小碎片 FX，避免创建过多 cluster。

## 7. 视觉辨识

V8.2 不把功能格画成过度科幻 UI，但需要肉眼可辨：

- beam：较深/偏金色木梁；
- powder：暗红/火药桶色；
- rudder：偏铜色；
- mast：深棕色；
- cannon：深灰色。

点击准星命中功能格附近时，可在准星上方短暂显示部位名：

- 主梁
- 火药舱
- 舵机
- 桅杆
- 炮位

第一版不做“穿几层提示”和放大镜 UI，避免范围膨胀。

## 8. 沉船与单舰规则

保持现有规则：

- 敌舰结构完整度 <= 34% 进入 sink；
- 我方旗舰 <= 24% 战败；
- 场上最多 1 艘 active 敌舰；
- 当前敌舰沉没后，下一艘按原刷新计时出现。

V8.2 不新增独立“功能部位全毁即沉船”规则，避免系统过早复杂化。

## 9. 测试合同

新增至少四组 V8.2 测试：

1. `v8_2_components.test.js`
   - 模板中存在 beam/powder/rudder/mast/cannon；
   - powder 不在外层；
   - 功能格是纯数据 cell。

2. `v8_2_material_penetration.test.js`
   - hull/deck/beam 的 penetration cost 不同；
   - 同样初始 penetration 下，beam 能更早耗尽炮弹；
   - 玩家炮弹继续连续命中，敌方炮弹仍单格停止。

3. `v8_2_powder_chain.test.js`
   - powder 摧毁会伤害周围多个 cell；
   - 不发生无限递归；
   - 爆炸后运行结构断裂检查并触发强反馈。

4. `v8_2_debris_cluster.test.js`
   - 失联的多格 component 生成一个 cluster；
   - cluster 保留多格相对布局；
   - 原船对应 cell 被移除；
   - cluster 会旋转、下沉并最终移除。

同时继续跑：

- V8.1 五项专项；
- V8.0 回归；
- 单舰规则；
- `js/v8/*.js` 语法检查；
- legacy V6/V7 回归。

## 10. 发布

完成后：

- 首页标题切为 `V8.2 · 部位破坏与连锁毁伤`；
- 所有 V8 script cache key 切为 `?v=8.2.0`；
- `legacy_v7.html` 不改；
- GitHub Pages 最终 SHA 部署成功后才算完成。
