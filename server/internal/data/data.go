// server/internal/data/data.go
package data

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"server/internal/biz"
	"server/internal/conf"

	entLogger "server/pkg/logger"

	"server/internal/data/model/ent"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/XSAM/otelsql"
	"github.com/go-kratos/kratos/v2/log"
	_ "github.com/go-sql-driver/mysql" // MySQL driver
	"github.com/google/wire"
	"go.opentelemetry.io/otel/attribute"
)

// ProviderSet 是 data 层对外暴露的依赖注入集合。
var ProviderSet = wire.NewSet(
	NewData,

	// auth
	NewAuthRepo,
	wire.Bind(new(biz.AuthRepo), new(*authRepo)),

	NewTokenGenerator,
	biz.NewAuthUsecase,

	// jsonrpc
	NewJsonrpcData,
	wire.Bind(new(biz.JsonrpcRepo), new(*JsonrpcData)),
)

// Data 聚合所有外部资源（DB、Redis、JsonrpcData 等）。
type Data struct {
	log   *log.Helper
	mysql *ent.Client
	sqldb *sql.DB // 👈 底层 DB，ent 和原生 SQL 共用同一份
}

// SQLDB 返回底层 DB，用于检查连通性
func (d *Data) SQLDB() *sql.DB {
	return d.sqldb
}

// NewData 由 wire 调用，用来统一管理资源和 cleanup。
func NewData(c *conf.Data, logger log.Logger) (*Data, func(), error) {
	l := log.NewHelper(log.With(logger, "logger.name", "data"))

	// ========= 1. 初始化唯一一份 otelsql.DB =========
	l.Info("init mysql(otelsql) start...")
	db, err := otelsql.Open(
		dialect.MySQL, // 实际就是 "mysql"
		c.Mysql.Dsn,
		otelsql.WithSpanOptions(otelsql.SpanOptions{
			OmitConnResetSession: true,  // 忽略重置会话
			OmitConnPrepare:      true,  // 忽略准备语句
			OmitConnQuery:        false, // 不忽略查询（要打 span）
			OmitRows:             true,  // 忽略 rows（行级 span）
			OmitConnectorConnect: true,  // 忽略连接器连接
		}),
		// 注意：这个 AttributesGetter 会把 SQL 和参数都写进 span，
		// 有隐私/体积问题的话可以后面再关掉。
		otelsql.WithAttributesGetter(func(
			ctx context.Context,
			method otelsql.Method,
			query string,
			args []driver.NamedValue,
		) []attribute.KeyValue {
			attrs := make([]attribute.KeyValue, 0, 1+len(args))
			attrs = append(attrs, attribute.String("db.statement", query))

			for _, a := range args {
				key := fmt.Sprintf("db.sql.arg.%d", a.Ordinal)
				if a.Name != "" {
					key = "db.sql.arg." + a.Name
				}
				attrs = append(attrs, attribute.String(key, fmt.Sprint(a.Value)))
			}
			return attrs
		}),
	)
	if err != nil {
		l.Errorf("failed to open mysql connection: %v", err)
		return nil, nil, err
	}

	// 可以在这里设置连接池参数（如果你配置里有，就用配置里的）
	// db.SetMaxIdleConns(10)
	// db.SetMaxOpenConns(100)
	// db.SetConnMaxLifetime(time.Hour)

	// Ping 一下，确保连得通
	if err := db.Ping(); err != nil {
		_ = db.Close()
		l.Errorf("mysql ping failed: %v", err)
		return nil, nil, err
	}
	l.Info("init mysql(otelsql) done!")

	// ========= 2. 基于同一个 db 创建 ent.Client =========
	mysqlClient := ent.NewClient(
		ent.Log(entLogger.NewEntLogger(logger)),
		ent.Driver(entsql.OpenDB(dialect.MySQL, db)), // 👈 关键：共用上面的 db
	)
	if mysqlClient == nil {
		_ = db.Close()
		l.Error("failed to create mysql client")
		return nil, nil, fmt.Errorf("failed to create mysql client")
	}

	if c.Mysql.Debug {
		// debug 模式下打印 SQL
		mysqlClient = mysqlClient.Debug()
	}
	l.Info("init ent mysql client done!")

	// ========= 3. Data 聚合：sqldb 和 ent 共用同一个 db =========
	data := &Data{
		log:   l,
		sqldb: db,          // 👈 原生 SQL 用这个
		mysql: mysqlClient, // 👈 ent 用这个，但底层也是 db
	}

	// 初始化管理员
	if err := InitAdminIfNeeded(context.Background(), data, c); err != nil {
		return nil, nil, err
	}

	// ========= 4. 统一关闭资源 =========
	cleanup := func() {
		if mysqlClient != nil {
			mysqlClient.Close()
		}
		if db != nil {
			db.Close()
		}
	}

	return data, cleanup, nil
}
