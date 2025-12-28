// server/cmd/dbcheck/main.go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// 默认参数：本机开发 / docker-compose
// - 本机直接连 192.168.0.106:3306
// - 在 compose 容器里跑的话，把 host 改成 mysql
const (
	defaultHost = "192.168.0.106"
	defaultPort = "3306"
	defaultDB   = "test_database_atlas"
)

// 方便通过环境变量覆盖
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

type mysqlAccount struct {
	Name string
	DSN  string
}

func main() {
	host := getenv("MYSQL_HOST", defaultHost)
	port := getenv("MYSQL_PORT", defaultPort)
	db := getenv("MYSQL_DB", defaultDB)

	// 这三个账号按你现在的配置来
	accounts := []mysqlAccount{
		{
			Name: "root",
			DSN:  fmt.Sprintf("root:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local", getenv("MYSQL_ROOT_PASSWORD", "YP*H%k%a7xK1*q"), host, port, db),
		},
		{
			Name: "test_user",
			DSN:  fmt.Sprintf("test_user:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local", getenv("MYSQL_TEST_PASSWORD", "2@&0kq%qFafA4d"), host, port, db),
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for _, acc := range accounts {
		fmt.Println("-------------------------------------------------")
		fmt.Printf("Testing MySQL account: %s\n", acc.Name)
		fmt.Printf("DSN (masked): %s\n", maskPassword(acc.DSN))

		if err := testMySQL(ctx, acc.DSN); err != nil {
			fmt.Printf("❌ %s connect failed: %v\n", acc.Name, err)
		} else {
			fmt.Printf("✅ %s connect OK\n", acc.Name)
		}
	}
}

func testMySQL(ctx context.Context, dsn string) error {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("sql.Open: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("PingContext: %w", err)
	}

	// 简单再跑个查询确认权限
	var now time.Time
	if err := db.QueryRowContext(ctx, "SELECT NOW()").Scan(&now); err != nil {
		return fmt.Errorf("SELECT NOW(): %w", err)
	}
	fmt.Println("server time:", now.Format(time.RFC3339))
	return nil
}

func maskPassword(dsn string) string {
	// 格式: user:pass@tcp(....)
	// 思路:
	//   1) 找到最后一个 '@' 作为“用户信息和地址的分界”
	//   2) 在这个 @ 之前，找到最后一个 ':' 当成“密码起点”
	at := strings.LastIndex(dsn, "@")
	if at == -1 {
		// 没有 @，就不处理了
		return dsn
	}

	beforeAt := dsn[:at]
	afterAt := dsn[at:] // 包含 @

	colon := strings.LastIndex(beforeAt, ":")
	if colon == -1 {
		// 没有 :，也不处理
		return dsn
	}

	// user:***@tcp(...)
	masked := beforeAt[:colon] + ":***" + afterAt
	return masked
}
