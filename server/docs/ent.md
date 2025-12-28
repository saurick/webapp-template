# ent 数据库 orm

本仓库 internal/data/model/ent/schema 基于原数据库生成，后期维护不需要直接改数据库，通过编写 internal/data/model/ent/schema 目录里面的代码即可

```shell
# 在 internal/data 目录运行
# 初始化的脚本，基于数据库中的表生成schema目录中的内容
# saurick 用户修改版，把 MySQL 的 BIGINT 映射到 Golang 的 int64
go run github.com/saurick/entimport/cmd/entimport -dsn "mysql://test_user:2%40%260kq%25qFafA4d@tcp(192.168.0.106:3306)/test_databse?charset=utf8mb4&parseTime=True&loc=Local&interpolateParams=true" -exclude-tables sys_authority_btns,sys_authority_menus,sys_chat_gpt_options,sys_data_authority_id,sys_user_authority

# 这个是原版的 entimport 工具，会将 MySQL BIGINT 类型映射到 Golang 的 int
go run ariga.io/entimport/cmd/entimport -dsn "mysql://root:password@tcp(localhost:3306)/dbname?charset=utf8mb4&parseTime=True&loc=Local" -exclude-tables sys_authority_btns,sys_authority_menus,sys_chat_gpt_options,sys_data_authority_id,sys_user_authority
```

* ent官方文档

<https://entgo.io/zh/docs/tutorial-setup>
