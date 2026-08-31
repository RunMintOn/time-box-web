# Time Box Web

一个以「Weekly Lego Board」为核心的个人 Timeboxing 实验。

## 核心模型

系统里只有两层概念：

- **Activity**：事情本身，也就是“积木模具”。课程、阅读、锻炼、自己的事情都是 Activity。Activity 可以带默认时长、重复日、时间刚性，以及地点 / 精力 / 自由度等属性。
- **Placement**：某个 Activity 在本周的一次具体出现。Placement 可以包含其他 Placement，因此任何 Activity 都可以临时成为“容器”。

嵌套关系发生在 Placement 上，而不是 Activity 定义上。同一个“阅读” Activity，周一可以放在课程里面，周二可以独立放在晚上，仍然是同一件事情。

```text
Activity
└─ Placement
   ├─ child Placement
   └─ child Placement
      └─ child Placement
```

当前 UI 最多展示三层，避免无限嵌套把周视图变成文件系统。

## 设计原则

- 时间是骨架，不是界面主角。
- 拖到空白区域 = 独立 Placement。
- 拖到另一个 Placement 上 = 嵌套。
- 拖出父块 = 脱离容器。
- 父 Activity 的地点 / 精力 / 自由度可以作为子 Activity 的环境信息。
- 一个 Placement 一旦包含子块，视觉上会自然变成“容器框”，但底层语义仍然是 Activity。

## 当前交互

- 从左侧积木盒拖 Activity 到任意一天。
- Placement 可跨天拖动。
- Placement 可以拖进另一个 Placement 形成嵌套。
- 嵌套块仍然可以继续移动或脱离父块。
- 靠近 15 分钟网格、父块边界、兄弟块边界时自动吸附。
- 拖 Placement 底部可改变本次时长。
- 重复 Activity 可一键铺到本周，再逐日移动。
- 右侧 Inspector 用于精确编辑当前选择、查看父级路径和环境信息。
- 数据保存在浏览器 `localStorage`，暂无后端。

## 架构

```text
index.html        页面骨架
styles.css        视觉与布局
src/state.js      Activity / Placement、嵌套关系、持久化
src/board.js      Weekly Board、拖拽、嵌套、resize、吸附
src/app.js        积木盒、Inspector、Dialog 与应用协调
```

这是无构建步骤的原生 ES Modules 前端，因此 GitHub Pages 可以直接从 `main / (root)` 发布。后续需要测试、组件化和打包时，可以迁移到 Vite / TypeScript，而不改变核心数据模型。
