package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Loan struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	MemberID   primitive.ObjectID `bson:"memberId" json:"memberId"`
	BookID     primitive.ObjectID `bson:"bookId" json:"bookId"`
	CopyID     primitive.ObjectID `bson:"copyId,omitempty" json:"copyId,omitempty"` // Null if Digital
	BranchID   string             `bson:"branchId" json:"branchId"`
	ItemType   string             `bson:"itemType" json:"itemType"` // "PHYSICAL", "DIGITAL"
	Status     string             `bson:"status" json:"status"`     // "BORROWED", "RETURNED", "OVERDUE"
	BorrowedAt time.Time          `bson:"borrowedAt" json:"borrowedAt"`
	DueDate    time.Time          `bson:"dueDate" json:"dueDate"`
	ReturnedAt time.Time          `bson:"returnedAt,omitempty" json:"returnedAt,omitempty"`
	FineAmount      int                `bson:"fineAmount,omitempty" json:"fineAmount"`
	IsPaid          bool               `bson:"isPaid,omitempty" json:"isPaid"`
	ReturnCondition string             `bson:"returnCondition,omitempty" json:"returnCondition"` // e.g. "Good", "Damaged"
	PickupAppointment time.Time        `bson:"pickupAppointment,omitempty" json:"pickupAppointment"`
	ReturnAppointment time.Time        `bson:"returnAppointment,omitempty" json:"returnAppointment"`
}

type BorrowRequest struct {
	BookID            string    `json:"bookId" binding:"required"`
	Type              string    `json:"type" binding:"required"` // "PHYSICAL" or "DIGITAL"
	PickupAppointment time.Time `json:"pickupAppointment"`       // Optional (Required for Physical)
}
