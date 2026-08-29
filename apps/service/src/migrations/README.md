# 数据库迁移

表结构唯一来源是 `src/entities/` 下的实体；本目录存放自动生成的迁移。

## 工作流

1. 修改实体（`src/entities/*.entity.ts`）
2. 生成迁移：`pnpm migration:generate --name=<PascalName>`（对当前数据库做 diff）
3. **人工审查**生成的 up/down SQL（数据回填需手写）
4. 在 `index.ts` barrel 中注册新迁移类 —— 未注册的迁移文件不会被执行
5. 提交（commit 钩子会校验：实体改动必须伴随已注册的新迁移）

## 约定

- 文件名：`<时间戳>-<PascalName>.ts`，类名 `<Name><时间戳>`
- 形式：`up()/down()` 循环执行文件底部的 `UP`/`DOWN` SQL 字符串数组
- 生成器已按依赖顺序重排 down 语句（约束 → 索引 → 表 → 枚举类型）
- 本地数据库：`docker compose up -d postgres`（PostgreSQL 18，lottery/lottery）
- 服务启动时自动应用未执行的迁移（与 `pnpm migration:run` 同一代码路径）
