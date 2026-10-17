package devdbguard

import "testing"

func TestDevelopmentTarget(t *testing.T) {
	for _, key := range []string{"PGHOST", "PGPORT", "PGDATABASE", "PGSERVICE", "PGSSLMODE"} {
		t.Setenv(key, "")
	}
	for _, tc := range []struct {
		name, dsn          string
		registered, reject bool
	}{
		{"unregistered remote", "postgres://test_user:unused@db.example.test:5432/project?sslmode=disable", false, true},
		{"retired source", "postgres://test_user:unused@192.0.2.20:5432/project", false, true},
		{"production port", "postgres://test_user:unused@192.0.2.10:5434/project", false, true},
		{"foreign project", "postgres://test_user:unused@192.0.2.10:5432/other_project", false, true},
		{"query host override", "postgres://test_user:unused@192.0.2.10:5432/project?host=127.0.0.1", false, true},
		{"query database override", "postgres://test_user:unused@192.0.2.10:5432/project?dbname=other_project", false, true},
		{"multiple hosts", "postgres://test_user:unused@192.0.2.10:5432,192.0.2.20:5432/project", false, true},
		{"isolated test", "postgres://test_user:unused@127.0.0.1:15432/test_run", false, false},
		{"IPv6 loopback", "postgres://test_user:unused@[::1]:15432/test_run", false, false},
		{"loopback query host override", "postgres://test_user:unused@127.0.0.1:15432/test_run?host=db.example.test", false, true},
		{"invalid", "not-a-dsn", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			registered, err := ValidateTarget("configs/dev/config.yaml", tc.dsn)
			if (err != nil) != tc.reject || registered != tc.registered {
				t.Fatalf("registered=%v, err=%v", registered, err)
			}
		})
	}
	registered, err := ValidateTarget("configs/prod/config.yaml", "postgres://postgres:unused@postgres:5432/production")
	if err != nil || registered {
		t.Fatal("development registration must not replace production configuration")
	}
}

func TestUnregisteredIdentityFailsClosed(t *testing.T) {
	for _, identity := range [][2]string{{"", ""}, {"project", "1"}, {"other_project", "2"}} {
		if err := ValidateIdentity(identity[0], identity[1]); err == nil {
			t.Fatal("an unregistered shared instance must be rejected")
		}
	}
}
