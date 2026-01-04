package models

import "go.mongodb.org/mongo-driver/bson/primitive"



type PolicyConfig struct {
	ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Basic RolePolicy         `bson:"basic" json:"basic"`
	VIP   RolePolicy         `bson:"vip" json:"vip"`
}
