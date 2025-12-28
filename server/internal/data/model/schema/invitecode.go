// server/internal/data/model/schema/invitecode.go
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type InviteCode struct {
	ent.Schema
}

func (InviteCode) Fields() []ent.Field {
	return []ent.Field{
		field.String("code").
			NotEmpty().
			MaxLen(32),
		field.Int("max_uses").
			Default(1), // 1 = 单次邀请码
		field.Int("used_count").
			Default(0),
		field.Time("expires_at").
			Optional().
			Nillable(),
		field.Bool("disabled").
			Default(false),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

func (InviteCode) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("code").Unique(),
	}
}
