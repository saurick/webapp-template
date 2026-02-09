// server/internal/data/model/schema/user.go
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type User struct {
	ent.Schema
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.String("username").
			NotEmpty().
			MaxLen(32),
		field.String("password_hash").
			NotEmpty().
			Sensitive(),
		field.String("invite_code").
			Optional().
			Nillable().
			MaxLen(32),
		field.Int8("role").
			Default(0).
			Comment("0=user, 1=admin"),
		field.Int("admin_id").
			Optional().
			Nillable().
			Comment("所属管理员ID"),
		field.Bool("disabled").
			Default(false),
		field.Time("last_login_at").
			Optional().
			Nillable(),
		field.Int64("points").
			Default(0).
			Comment("积分"),
		field.Time("expires_at").
			Optional().
			Nillable().
			Comment("会员到期时间"),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

func (User) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("username").Unique(),
		index.Fields("invite_code"),
		index.Fields("admin_id"),
	}
}
