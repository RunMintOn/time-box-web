# Time Box Web

一个以「Weekly Lego Board」为核心的个人 Timeboxing 实验。

## 核心模型

- **Context**：某段时间的客观环境或约束，例如课程、地点、精力、自由度。它是一块背景底板，不代表你一定在做这件事。
- **Activity**：事情本身，例如阅读、锻炼、写作。它像一种积木模具，可定义默认时长、重复日、时间刚性。
- **Placement**：Activity 在某一天、某个位置的一次具体实例。同一个 Activity 可以在一周中出现多次，而且每天的位置不同。

## 设计原则

时间是骨架，不是界面主角。默认视图强调「积木」和「底板」；只有拖动或调整时，具体时间与吸附线才变得明显。

## 当前交互

- 从左侧积木盒把 Activity 拖进任意一天。
- Placement 可跨天拖动。
- 靠近 15 分钟网格、Context 边界、其他 Placement 边界时自动吸附。
- 拖 Placement 底部可改变本次时长。
- Context 作为半透明底板，可与 Placement 叠放。
- 重复 Activity 可一键铺到本周，再逐日移动。
- 右侧 Inspector 用于精确编辑当前选择。
- 数据保存在浏览器 `localStorage`，暂无后端。

## 架构

```text
index.html        页面骨架
styles.css        视觉与布局
src/state.js      数据模型、持久化、状态更新
src/board.js      Weekly Board 渲染、拖拽、resize、吸附
src/app.js        积木盒、Inspector、Dialog 与应用协调
```

这是无构建步骤的原生 ES Modules 前端，因此 GitHub Pages 可以直接从 `main / (root)` 发布。后续需要复杂组件、测试和打包时，再迁移到 Vite/TypeScript，不影响数据模型。
