# V6.0 自由接舷系统设计

日期：2026-09-01

## 目标

把当前 V5.x 的“上舷 / 下舷 / 双舷固定槽位”接舷系统，重构为**连续接舷边界**。

核心规则只有一句：

> **没有固定接舷位。敌船在哪里真实碰到旗舰，哪里就是接触点；从该接触点搭板、抛钩并登船。能否贴帮只由真实船体碰撞和可用空间决定。**

本次 V6.0 只重构接舷、搭板和登船入口，不改关卡数、敌船类型、自动开炮开关、旗舰无限血、甲板近战测试模式等已经存在的独立功能。

## 当前问题

V5.x 仍以 `SLOTS.upper / lower / both` 为核心：

- `slotBlocked()` 会把某个逻辑槽位视为被占用；
- `chooseDockSlot()` 要求敌船先拿到槽位才能靠近；
- 巨舰用 `both` 同时占上、下舷；
- `slotTargetY()`、`dockCX()`、`shipsTouchPlayer()` 都依赖槽位 Y；
- `deployBoarder()` 和 `drawDockedGear()` 把跳板、抓钩位置写死在固定 Y；
- HUD 仍显示“上舷 / 下舷”。

这会造成多艘敌船靠近时出现逻辑占位与物理位置不一致，进而形成接舷死锁。

## V6.0 架构

### 1. 敌船状态

接舷船统一使用：

`approach -> closing -> docked -> retreat`

不再存在任何 `slot`、`upper`、`lower`、`both` 语义。

- `approach`：正常从右向左航行。
- `closing`：进入旗舰附近后继续保持船头朝左，并根据物理空间做有限纵向避让。
- `docked`：敌船船头真实接触旗舰边界，记录动态接触点并锁舷。
- `retreat`：登船失败或海盗清空后脱离。

敌船在存活状态下保持 `rot = 0`；只有沉船动画允许额外旋转。

### 2. 动态接触数据

删除敌船的固定槽位字段，接舷船在真正贴帮时只记录：

```js
contactX
contactY
contact=false|true
```

其中：

- `contactY` 是敌船实际与旗舰右侧船体相交的位置；
- `contactX = playerHullRightX(contactY)`。

`docked` 后以这组接触数据为唯一接舷依据，不再重新吸附到预设 Y。

### 3. 自由接触算法

旗舰右侧碰撞轮廓继续使用现有椭圆近似：

```js
playerHullRightX(y)
```

每艘接舷船使用水平包围盒近似：

```js
enemyCollider(e) -> {rx, ry}
enemyBowX(e) = e.x - rx
```

接触判定：

1. 敌船当前 Y 与旗舰可接触纵向范围有重叠；
2. 取敌船中心 Y 经过安全裁剪后的 `contactY`；
3. 计算 `hullX = playerHullRightX(contactY)`；
4. 当 `enemyBowX(e) <= hullX + skin` 时视为真实接触；
5. 将敌船 X 修正为 `hullX + rx - skin`，记录 `contactX/contactY`，进入 `docked`。

不再要求敌船先对齐某个固定 Y。

### 4. 多船并行接舷

不再使用 `slotBlocked()`。

多艘船能否同时贴帮，只由**敌船之间的真实碰撞包围盒**决定：

- 两艘船在 Y 方向不重叠：可以同时贴帮；
- Y 方向空间不足：后船被前船物理挡住；
- 巨舰因为 `colB` 更大，会自然占据更大的纵向接舷范围；
- 不再对巨舰写任何 `both` 特判。

为避免多船互相“挤穿”，`docked` 船视为静态障碍；`closing` 船只能被推离，不能推动已贴帮船。

### 5. 靠近时的纵向行为

敌船不再被吸向 `upper/lower`。

`closing` 时优先保持自身当前 Y。如果正前方被另一艘船挡住，则只做**小幅、限速纵向避让**，尝试寻找附近空隙；若没有空间，就自然排队。

V6.0 不做复杂寻路，只使用局部避让，避免增加不必要复杂度。

### 6. 动态搭板 / 抓钩

`drawDockedGear(e)` 改为只依赖：

```js
e.contactX
e.contactY
enemyBowX(e)
```

每艘贴帮船绘制一条主跳板：

- 旗舰端：`contactX/contactY` 附近的甲板入口；
- 敌船端：敌船船头甲板边缘；
- 跳板角度根据两端连线动态计算；
- 抓钩沿相同接触点附近绘制。

不再读取 `SLOTS.upper.plankY`、`SLOTS.lower.plankY` 或固定 hookY。

巨舰仍只使用一个动态接触中心，但可以根据自身船宽生成两条相邻跳板，位置为 `contactY ± offset`；两个点必须落在旗舰可接触边界内。这样保留巨舰多人同时登船的视觉能力，同时不重新引入逻辑槽位。

### 7. 海盗出生和登船路径

`deployBoarder(e)` 不再读取 slot。

新的出生/路径：

- `plank`：从敌船船头 `enemyBowX(e)` 附近出生，先走到动态接触点，再进入旗舰甲板；
- `swing`：锚点来自敌船船头附近，落点来自动态 `contactX/contactY`；
- `climb`：从接触点附近翻舷进入甲板。

进入旗舰后的最终落点只做少量随机偏移，确保海盗不会全部叠在一个像素点。

海盗进入 `fight` 状态后继续沿用当前甲板战 AI。

### 8. HUD

删除：

- “上舷 接舷 / 空闲”
- “下舷 接舷 / 空闲”
- 菜单中“上舷 / 下舷独立接舷位”的说明

保留顶部：

`接舷战！X 艘贴帮 · Y 名海盗`

其中 X 只统计：

```js
state === 'docked' && contact === true
```

### 9. 文件结构和清理

V6.0 不继续堆叠临时补丁，而是把自由接舷写回核心模块。

计划修改：

- `js/10_model.js`
  - 删除 `SLOTS`
  - 删除 `slotTargetY()`、`slotBlocked()`、`chooseDockSlot()`
  - 重写动态接触辅助函数
  - 敌船模型移除 `slot`

- `js/21_boarding_update.js`
  - 重写接舷船 `approach/closing/docked/retreat`
  - 重写 `deployBoarder()` 动态入口

- `js/40_scene.js`
  - 重写 `drawDockedGear()` 为动态接触点版本
  - 保留 `drawFxAll()` 中 `clamp(f.t/f.dur,0,1)` 的沉船卡死修复，不得回退

- `js/50_hud_overlay.js`
  - 删除固定槽位 HUD 与旧菜单说明

- `js/55_levels.js`
  - 保持关卡增强逻辑；确认 `deployBoarder()` 包装仍正确传递 boolean 返回值

- `js/60_input_loop.js`
  - 清理旧 `turning/rot>0.9` 的接舷视觉调用条件

计划删除或停止加载：

- `js/41_collision_visual.js`：动态接触逻辑进入核心后不再需要视觉补丁
- `js/58_berthing_contact_fix.js`：其行为合并进核心后删除

继续保留：

- `js/56_auto_cannon.js`
- `js/57_infinite_ship_hp.js`
- `js/59_melee_test_mode.js`

最终入口更新为 V6.0。

## 数据流

每帧接舷流程：

1. 生成敌船；
2. 接舷型敌船持续向左航行；
3. 进入旗舰附近后进入 `closing`；
4. 先处理敌船之间碰撞与局部纵向避让；
5. 计算敌船船头与旗舰右侧轮廓是否真实接触；
6. 接触成功：记录 `contactX/contactY`，进入 `docked`；
7. `docked`：绘制动态跳板/抓钩；
8. `deployBoarder()` 从动态接触点生成海盗；
9. 海盗到达甲板后进入 `fight`；
10. 登船海盗清空后敌船 `retreat`。

## 边界与失败处理

- `contactY` 必须限制在旗舰实际可接触的纵向范围内，防止椭圆函数在船头/船尾外产生错误位置。
- 若敌船因碰撞无法继续靠近，则保持 `closing`，不能生成海盗。
- `deployBoarder(e)` 必须在 `e.state==='docked' && e.contact===true` 时才返回 true。
- 敌船沉没时清理对应未完成登船的海盗，沿用当前规则。
- 已进入 `fight` 的海盗即使母船沉没，继续留在甲板战斗，沿用当前规则。
- 接舷船退出/沉没时清除自己的动态 contact 数据。
- 不能因多船拥挤出现 NaN、负半径或无限循环。

## 测试策略

实现必须先写失败测试，再改生产代码。

至少覆盖：

1. 不存在 `SLOTS`、`slotBlocked()`、`chooseDockSlot()` 的核心依赖；
2. 任意三个不同 Y 的敌船都能计算自己的动态接触点；
3. 敌船未接触旗舰时 `deployBoarder()` 返回 false；
4. 任意 Y 真正接触后进入 `docked` 并记录 contact；
5. 两艘纵向不重叠的船可以同时 `docked`；
6. 两艘发生物理重叠时后船不能穿过前船；
7. 巨舰不使用 `both`，但因体积自然阻挡更大范围；
8. 跳板位置跟随 `contactY` 改变，而不是固定在 428/668；
9. 海盗出生点跟随动态接触点；
10. HUD 不再显示上舷/下舷；
11. 关卡 `deployBoarder` 包装仍保留 false/true 语义；
12. 自动开炮默认关闭仍有效；
13. 旗舰无限血仍有效；
14. 甲板近战测试模式：弓箭手远程不射，海盗 `fight` 后恢复射击；
15. 沉船特效进度保持 clamp，击沉敌船后主循环不冻结；
16. JS 全量语法检查通过；
17. 浏览器烟雾测试运行数秒无 console exception。

## 完成标准

V6.0 只有在以下条件同时满足时才算完成：

- 用户肉眼看不到任何固定接舷位行为；
- 敌船可以在旗舰右侧任意合理 Y 位置真实贴帮；
- 多船能自然并排，拥挤时由碰撞而非槽位规则排队；
- 跳板/抓钩从实际接触点生成；
- 海盗从该位置进入甲板；
- 不再加载 V5.7 的接舷补丁文件；
- V5.5 自动开炮、V5.6 无限血、V5.8 近战测试模式继续可用；
- 所有回归测试与浏览器烟雾测试通过。
