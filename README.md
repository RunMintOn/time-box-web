# Time Box Web

一个极简的、以周视图为核心的 Timebox 原型。

## V0 的三个概念

- **Context Block**：某段时间的客观环境或约束，例如课程、地点、精力、自由度。它是背景，不代表你必须做某件事。
- **Activity**：事情本身，例如阅读、锻炼、写作业。可以带预计时长、重复日、偏好时间、时间刚性。
- **Placement**：某个 Activity 在某一天、某个时间位置的一次具体安排。同一个 Activity 可以有很多 Placement，而且每一天的位置可以不同。

## 核心交互

1. 左侧创建 Activity。
2. 把 Activity 拖到周一到周日任意一天，生成一次 Placement。
3. 已生成的 Placement 可以继续拖动到别的时间或别的天。
4. 双击 Placement 可以精确修改时间和本次时长。
5. Context Block 作为背景显示，可以和 Placement 重叠。
6. 重复 Activity 可以“一键铺到本周”，之后每个实例仍可独立移动。
7. 数据使用 `localStorage` 保存在当前浏览器，无后端。

## 运行

直接下载并打开 `index.html` 即可。

当前版本是用于验证方法和交互模型的 V0，不追求完整的日历精度或复杂任务管理功能。
