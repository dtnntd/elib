package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PhysicalCopy struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	BookID    primitive.ObjectID `bson:"bookId" json:"bookId"`
	BranchID  string             `bson:"branchId" json:"branchId"`
	Barcode   string             `bson:"barcode" json:"barcode"` // Unique: ISBN-BRANCH-SEQ
	Status    string             `bson:"status" json:"status"`     // "AVAILABLE", "RESERVED", "BORROWED", "LOST", "DAMAGED"
	Condition string             `bson:"condition" json:"condition"` // "GOOD", "DAMAGED"
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}
