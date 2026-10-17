// Package devdbguard protects development database target selection.
package devdbguard

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	// 派生项目采用共享开发库时，按真实实例登记并同步测试与运维文档。
	Host             = ""
	Port             = 5432
	Database         = ""
	SystemIdentifier = ""
)

// ValidateTarget keeps explicit loopback test databases available. Shared remote
// development must use this project's registered instance and database.
func ValidateTarget(confPath, dsn string) (bool, error) {
	clean := "/" + strings.Trim(filepath.ToSlash(filepath.Clean(confPath)), "/") + "/"
	if !strings.Contains(clean, "/configs/dev/") {
		return false, nil
	}
	invalid := errors.New("development database target rejected; use an isolated loopback database or register this project's shared development instance")
	u, err := url.Parse(dsn)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		return false, invalid
	}
	cfg, err := pgconn.ParseConfig(dsn)
	if err != nil {
		return false, invalid
	}
	// A query parameter or PG environment must not change the declared target.
	port := u.Port()
	if port == "" {
		port = "5432"
	}
	if u.Hostname() != cfg.Host || port != fmtPort(cfg.Port) ||
		strings.TrimPrefix(u.Path, "/") != cfg.Database {
		return false, invalid
	}
	for _, fallback := range cfg.Fallbacks {
		if fallback.Host != cfg.Host || fallback.Port != cfg.Port {
			return false, invalid
		}
	}
	ip := net.ParseIP(cfg.Host)
	if cfg.Host == "localhost" || (ip != nil && ip.IsLoopback()) {
		return false, nil
	}
	if Host == "" || Database == "" || SystemIdentifier == "" ||
		cfg.Host != Host || cfg.Port != Port || cfg.Database != Database {
		return false, invalid
	}
	return true, nil
}

func fmtPort(port uint16) string {
	return fmt.Sprintf("%d", port)
}

func ValidateIdentity(database, systemIdentifier string) error {
	if Database == "" || SystemIdentifier == "" ||
		database != Database || systemIdentifier != SystemIdentifier {
		return errors.New("development database identity mismatch; refusing to use this instance")
	}
	return nil
}

// Verify checks physical cluster identity before startup or an Atlas command.
// Connection errors are deliberately redacted because pgx errors can contain DSNs.
func Verify(confPath, dsn string) error {
	registered, err := ValidateTarget(confPath, dsn)
	if err != nil || !registered {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return errors.New("cannot verify the registered development database connection")
	}
	defer func() { _ = conn.Close(ctx) }()
	var database, systemIdentifier string
	if err := conn.QueryRow(ctx, "SELECT current_database(), system_identifier::text FROM pg_control_system()").Scan(&database, &systemIdentifier); err != nil {
		return errors.New("cannot read the registered development database identity")
	}
	return ValidateIdentity(database, systemIdentifier)
}
