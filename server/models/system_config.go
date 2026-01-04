package models

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type RolePolicy struct {
	MaxPhysical         int `bson:"maxPhysical" json:"maxPhysical"`
	MaxDigitalUnlimited int `bson:"maxDigitalUnlimited" json:"maxDigitalUnlimited"`
	MaxDigitalOCOU      int `bson:"maxDigitalOCOU" json:"maxDigitalOCOU"`
}

type VIPPackageConfig struct {
	ID       string `bson:"id" json:"id"`
	Name     string `bson:"name" json:"name"`
	Duration int    `bson:"duration" json:"duration"` // days
	Price    int    `bson:"price" json:"price"`       // VND
	Discount int    `bson:"discount" json:"discount"` // percentage
}

type VIPPackagesValue struct {
	Packages []VIPPackageConfig `bson:"packages" json:"packages"`
}

type PolicyValue struct {
	Basic RolePolicy `bson:"basic" json:"basic"`
	VIP   RolePolicy `bson:"vip" json:"vip"`
}

type SystemConfig struct {
	ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Key   string             `bson:"key" json:"key"` // "LOAN_POLICY" or "VIP_PACKAGES"
	Value interface{}        `bson:"value" json:"value"` // Can be PolicyValue or VIPPackagesValue
}
