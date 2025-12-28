# model

数据库ORM

# 目录说明

路径 | 说明
---- | ----
ent/ | 通过 go generate 生成的代码，永远不需要编辑
schema/ | 数据库表的结构描述，通过此目录文件生成 ent/
generate.go | 生成 ent/*.go 代码的生成器
