package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Transaction struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	MemberID    primitive.ObjectID `bson:"memberId" json:"memberId"`
	Amount      int                `bson:"amount" json:"amount"`           // Currency value (e.g., +50000 or -5000)
	Type        string             `bson:"type" json:"type"`               // "DEPOSIT", "FINE"
	Description string             `bson:"description" json:"description"` // e.g., "Top up wallet", "Overdue fine for book X"
	CreatedAt   time.Time          `bson:"createdAt,omitempty" json:"createdAt"`
}
