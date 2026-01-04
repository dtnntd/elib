package models

import (
	"time"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VIPPackage struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PackageID string             `bson:"packageId" json:"packageId"` // e.g., "1month", "3months"
	Name      string             `bson:"name" json:"name"`
	Duration  int                `bson:"duration" json:"duration"` // days
	Price     int                `bson:"price" json:"price"`       // VND
	Discount  int                `bson:"discount" json:"discount"` // percentage
	IsActive  bool               `bson:"isActive" json:"isActive"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}
