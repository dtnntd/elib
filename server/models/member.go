package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Subscription struct {
	Active    bool      `bson:"active" json:"active"`
	Plan      string    `bson:"plan" json:"plan"` // "BASIC", "VIP"
	ExpiredAt time.Time `bson:"expiredAt" json:"expiredAt"`
}

type Member struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	BranchID      string             `bson:"branchId" json:"branchId"`
	FullName      string             `bson:"fullName" json:"fullName"`
	Email         string             `bson:"email" json:"email"`
	PasswordHash  string             `bson:"passwordHash" json:"-"` // Hide from JSON
	Role          string             `bson:"role" json:"role"`      // "MEMBER", "STAFF", "ADMIN"
	WalletBalance int                `bson:"walletBalance" json:"walletBalance"`
	Subscription  Subscription       `bson:"subscription" json:"subscription"`
	CreatedAt     time.Time          `bson:"createdAt,omitempty" json:"createdAt"`
}
