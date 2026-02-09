# 🤖 AI 助手数据库变更操作手册 (必读)

**STOP! 在修改数据库或创建 `.sql` 文件之前，请务必阅读本指南。**

本项目使用 **Ent** 和 **Atlas** 进行版本化的数据库迁移。
**严禁** 在 `migrate/` 目录下手动编写 `.sql` 文件。
**严禁** 手动执行 `ALTER TABLE` 或 `CREATE TABLE` 语句。

## 🟢 正确的工作流 (HOW TO DO IT)

1.  **修改 Ent Schema (Go 代码)**:
    修改位于 `server/internal/data/model/schema/*.go` 的 Go 文件。
    例如：在 `Fields()` 方法中添加 `field.String("new_col")`。

2.  **生成迁移文件**:
    在 `server/` 目录下运行以下命令：
    ```bash
    make data
    ```
    *解释：此命令会自动运行 `atlas migrate diff` (根据你的 schema 变更生成 `.sql` 文件) 和 `ent generate` (更新 Go 客户端代码)。*

3.  **应用迁移**:
    运行：
    ```bash
    make migrate_apply
    ```
    *解释：此命令会将生成的 SQL 应用到实际数据库，并更新 `atlas_schema_revisions` 表。*

## 🔴 严格禁止的操作 (WHAT NOT TO DO)

*   ❌ **绝对不要** 手动创建类似 `2024..._migrate.sql` 的文件。这会破坏 checksum 哈希校验 (`atlas.sum`)。
*   ❌ **绝对不要** 试图通过 `INSERT INTO` 或 `ALTER TABLE` 直接“修复”数据库结构而不走迁移流程。Atlas 会检测到结构漂移 (drift) 并报错。
*   ❌ **绝对不要** 随意删除迁移文件，除非你完全理解后果（这会破坏迁移历史图谱）。

## 🛠 常见问题处理

*   **Checksum Mismatch (校验和不匹配)**: 如果遇到此错误，请运行 `make migrate_hash`。
*   **Drift Detected / Duplicate Column (字段已存在)**: 如果数据库里已经有了某个字段（比如因为你手动加过），但迁移文件里又要加一遍，请使用 `make migrate_set` 跳过该版本，或先清理数据库中的脏数据。

---
**请严格遵守此流程以保证数据库完整性。**
