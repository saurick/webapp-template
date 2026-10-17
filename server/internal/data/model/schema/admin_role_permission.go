package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AdminRolePermission struct {
	ent.Schema
}

func (AdminRolePermission) Fields() []ent.Field {
	return []ent.Field{
		field.Int("admin_role_id"),
		field.Int("admin_permission_id"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

func (AdminRolePermission) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("admin_role_id", "admin_permission_id").Unique(),
		index.Fields("admin_permission_id"),
	}
}
