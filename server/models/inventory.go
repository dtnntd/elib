package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Inventory struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	BookID          primitive.ObjectID `bson:"bookId" json:"bookId"`
	BranchID        string             `bson:"branchId" json:"branchId"` // "HN", "HP", "DN"
	TotalCopies     int                `bson:"totalCopies" json:"totalCopies"`
	AvailableCopies int                `bson:"availableCopies" json:"availableCopies"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
	UpdatedBy       primitive.ObjectID `bson:"updatedBy" json:"updatedBy"` // Staff/Admin who updated
}
