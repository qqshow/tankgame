# 坦克大战 · 萌萌对战

浏览器里的双人坦克对战，单文件离线可玩。用 Safari 打开仓库根目录的 `index.html`。

## 怎么玩

三局两胜，每局每人一条命。键盘和 Joy-Con 都可以操作。

键盘：

- 玩家 1：W A S D 移动，空格开炮，E 地雷，Q 烟雾，R 手雷
- 玩家 2：方向键移动，回车开炮，句号键地雷，逗号键烟雾，分号键手雷

人机对战时，也可以用方向键移动，空格或回车开炮。

Joy-Con（系统把左右手柄合并成一个时，游戏会自动拆开）：

- P1 左手 Joy-Con：十字键/左摇杆移动，ZL 开炮，L 手雷，减号地雷，按下摇杆烟雾
- P2 右手 Joy-Con：右摇杆移动，ZR/A/B 开炮，Y 地雷，X 烟雾，R 手雷

macOS 上的 Chrome 可能检测不到 Joy-Con，请用 Safari。

## 从源码重新构建

TypeScript 源码在 `src/`：`game.ts`、`audio.ts`、`app.ts`，以及由三者拼接而成的 `all.ts`。`package.json` 和 `build.sh` 在仓库根目录。

```bash
npm install
bash build.sh
```

`build.sh` 会做严格类型检查、打包，并覆盖根目录的 `index.html`。不要提交 `node_modules/`。

## 版本记录

- v1 (2026-10-29)：手柄左右拆分、十字键移动、背景音乐与音效
