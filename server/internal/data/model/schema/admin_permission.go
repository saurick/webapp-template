package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type AdminPermission struct {
	ent.Schema
}

func (AdminPermission) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			NotEmpty().
			MaxLen(96),
		field.String("name").
			NotEmpty().
			MaxLen(64),
		field.String("group").
			Optional().
			Default("").
			MaxLen(64),
		field.String("description").
			Optional().
			Default("").
			MaxLen(255),
		field.Bool("builtin").
			Default(false),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

func (AdminPermission) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key").Unique(),
	}
}
