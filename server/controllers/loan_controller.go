package controllers

import (
	"context"
	"elibrary-api/config"
	"elibrary-api/models"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// BorrowBook handles both Physical and Digital borrowing
func BorrowBook(c *gin.Context) {
	// 1. Get User Info from Context (set by AuthMiddleware - to be implemented/verified)
	// For now assuming we parse token in middleware and set "user"
	// But wait, we haven't implemented AuthMiddleware yet.
	// Let's implement a quick helper or assume passed in header for verifying logic first,
	// BUT typically we use c.Set() in middleware.
	// For this step I will extract UserID from context assuming Middleware runs before.
	// REUSE: Let's extract from JWT manually here if middleware isn't global yet,
	// OR better: Assume we will add middleware next step.
	
	// Let's use a mock user ID retrieval or proper middleware later.
	// I'll grab user from "user" context key.
	userVal, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userVal.(*models.Member) // Type assertion

	var req models.BorrowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bookObjID, _ := primitive.ObjectIDFromHex(req.BookID)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	loanColl := config.GetCollection("loans")
	
	// 2. CHECK ELIGIBILITY
	// 2.1 Subscription Active?
	if !user.Subscription.Active || user.Subscription.ExpiredAt.Before(time.Now()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Subscription expired"})
		return
	}

	// 2.2 Quota Check
	// Basic: 2, VIP: 5 (Physical). Unlimited for Digital (VIP).
	maxLoans := 2
	if user.Subscription.Plan == "VIP" {
		maxLoans = 5
	}
	
	activeLoans, _ := loanColl.CountDocuments(ctx, bson.M{
		"memberId": user.ID,
		"status":   "BORROWED",
		"itemType": "PHYSICAL",
	})
	
	// 2.3 Check Duplicate Active Loan (Prevent borrowing same book twice OF THE SAME TYPE)
	// Allow 1 Physical AND 1 Digital, but not 2 Physical or 2 Digital of the same book
	duplicateCount, _ := loanColl.CountDocuments(ctx, bson.M{
		"memberId": user.ID,
		"bookId":   bookObjID,
		"itemType": req.Type, // Only check for the specific type being requested
		// Check for BORROWED, ACTIVE, OVERDUE, AND RESERVED
		"status":   bson.M{"$in": []string{"BORROWED", "ACTIVE", "OVERDUE", "RESERVED"}}, 
	})
	
	if duplicateCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "You already have an active or reserved loan for this book"})
		return
	}

	if req.Type == "PHYSICAL" {
		if int(activeLoans) >= maxLoans {
			c.JSON(http.StatusForbidden, gin.H{"error": "Loan quota exceeded"})
			return
		}

		// Validate Pickup Appointment
		if req.PickupAppointment.IsZero() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pickup appointment time is required for physical books"})
			return
		}
		if req.PickupAppointment.Before(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pickup time must be in the future"})
			return
		}

		// 3. PHYSICAL LOGIC
		copyColl := config.GetCollection("physical_copies")
		
		// Find Available Copy in User's Branch
		var copyDoc struct {
			ID primitive.ObjectID `bson:"_id"`
			BranchID string       `bson:"branchId"`
		}
		
		err := copyColl.FindOneAndUpdate(
			ctx,
			bson.M{"bookId": bookObjID, "branchId": user.BranchID, "status": "AVAILABLE"},
			bson.M{"$set": bson.M{"status": "RESERVED"}}, // Mark as RESERVED, not borrowed yet
		).Decode(&copyDoc)

		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusConflict, gin.H{"error": "No available copies in your branch"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
			return
		}

		// Create Loan
		loan := models.Loan{
			ID:                primitive.NewObjectID(),
			MemberID:          user.ID,
			BookID:            bookObjID,
			CopyID:            copyDoc.ID,
			BranchID:          copyDoc.BranchID,
			ItemType:          "PHYSICAL",
			Status:            "RESERVED", // Initial status
			BorrowedAt:        time.Now(), // This is actually "ReservedAt" for now, or use separate field. 
			                               // Implementation Plan said "System sets ReservedAt". 
			                               // To avoid schema drift, let's reuse BorrowedAt as creation time, or add ReservedAt.
			                               // For simplicity, let's say BorrowedAt is creation/reservation time. 
			                               // Actual "Checkout" will update it or we use another field.
			                               // Let's stick to simple: BorrowedAt = Reservation Time. DueDate is empty/zero until checkout.
			PickupAppointment: req.PickupAppointment,
		}

		_, err = loanColl.InsertOne(ctx, loan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create loan record"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Book reserved successfully. Please pick up at your appointment time.", "loan": loan})

	} else if req.Type == "DIGITAL" {
		// 4. DIGITAL LOGIC
		if user.Subscription.Plan != "VIP" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Digital access requires VIP plan"})
			return
		}
		
		// Create Loan (No copy tracking needed for MVP)
		loan := models.Loan{
			ID:         primitive.NewObjectID(),
			MemberID:   user.ID,
			BookID:     bookObjID,
			BranchID:   user.BranchID,
			ItemType:   "DIGITAL",
			Status:     "ACTIVE",
			BorrowedAt: time.Now(),
			DueDate:    time.Now().AddDate(0, 0, 14),
		}
		
		_, err := loanColl.InsertOne(ctx, loan)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create loan record"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "E-book access granted", "loan": loan})
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type"})
	}
}

// LoanPopulated includes book details
type LoanPopulated struct {
	ID         primitive.ObjectID `bson:"_id" json:"id"`
	MemberID   primitive.ObjectID `bson:"memberId" json:"memberId"`
	BookID     primitive.ObjectID `bson:"bookId" json:"bookId"`
	CopyID     primitive.ObjectID `bson:"copyId" json:"copyId"`
	BranchID   string             `bson:"branchId" json:"branchId"`
	ItemType   string             `bson:"itemType" json:"itemType"`
	Status     string             `bson:"status" json:"status"`
	BorrowedAt time.Time          `bson:"borrowedAt" json:"borrowedAt"`
	DueDate    time.Time          `bson:"dueDate" json:"dueDate"`
	ReturnedAt      time.Time          `bson:"returnedAt" json:"returnedAt"`
	FineAmount      int                `bson:"fineAmount" json:"fineAmount"`
	ReturnCondition string             `bson:"returnCondition" json:"returnCondition"`
	PickupAppointment time.Time        `bson:"pickupAppointment" json:"pickupAppointment"`
	ReturnAppointment time.Time        `bson:"returnAppointment" json:"returnAppointment"`
	Book            models.Book        `bson:"book" json:"book"` // Populated
}

// GetMyLoans returns active and past loans with Book Details
func GetMyLoans(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"memberId": user.ID}}},
		{{Key: "$sort", Value: bson.M{"borrowedAt": -1}}}, // Newest first
		{{Key: "$lookup", Value: bson.M{
			"from":         "books",
			"localField":   "bookId",
			"foreignField": "_id",
			"as":           "book",
		}}},
		{{Key: "$unwind", Value: "$book"}},
	}
	
	cursor, err := config.GetCollection("loans").Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch loans"})
		return
	}
	defer cursor.Close(ctx)

	var loans []LoanPopulated
	// Default to empty slice to avoid null in JSON
	loans = []LoanPopulated{} 
	
	if err = cursor.All(ctx, &loans); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Decoding error"})
		return
	}

	c.JSON(http.StatusOK, loans)
}


// ReturnBook handles returning a book (Physical or Digital)
// For MVP: Physical returns are marked 'RETURNED' (simulating staff action or kiosk)
// Digital returns are 'RETURNED' immediately (revoking access)
func ReturnBook(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	loanID := c.Param("id")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	loanColl := config.GetCollection("loans")
	objID, _ := primitive.ObjectIDFromHex(loanID)

	// 1. Find Loan & Verify Ownership
	var loan models.Loan
	err := loanColl.FindOne(ctx, bson.M{"_id": objID, "memberId": user.ID, "status": bson.M{"$in": []string{"BORROWED", "ACTIVE", "OVERDUE"}}}).Decode(&loan)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found or already returned"})
		return
	}

	// 2. Helper Update Fields
	updateFields := bson.M{
		"status":     "RETURNED",
		"returnedAt": time.Now(),
	}

	// 3. Handle Physical vs Digital Specifics
	if loan.ItemType == "PHYSICAL" {
		// For MVP: We assume this API is called by Staff or Self-Check Kiosk (authenticated as user for simplicity now, or we can restricting it).
		// *Correction*: User requested "Return Ebook". Physical returns usually done at counter.
		// IF user calls this for PHYSICAL, we might want to block it or allow it as "Self-Return Kiosk" mode.
		// Let's allow it for now for testing flexibility, but maybe add a note.
		
		// Update Physical Copy Status -> AVAILABLE
		copyColl := config.GetCollection("physical_copies")
		_, err := copyColl.UpdateOne(ctx, bson.M{"_id": loan.CopyID}, bson.M{"$set": bson.M{"status": "AVAILABLE"}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update copy status"})
			return
		}
		
		// Calculate Fine (Mock logic)
		if time.Now().After(loan.DueDate) {
			daysOverdue := int(time.Since(loan.DueDate).Hours() / 24)
			if daysOverdue > 0 {
				updateFields["fineAmount"] = daysOverdue * 5000 // 5k VND per day
			}
		}
		updateFields["returnCondition"] = "Good" // Default
		
	} else {
		// Digital: Just mark returned (revoked)
	}

	// 4. Update Loan Record
	_, err = loanColl.UpdateOne(ctx, bson.M{"_id": objID, "memberId": loan.MemberID, "bookId": loan.BookID, "branchId": loan.BranchID, "borrowedAt": loan.BorrowedAt}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to return book"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Book returned successfully"})
}

// UpdateReturnAppointment allows user to schedule a return time
func UpdateReturnAppointment(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	loanID := c.Param("id")

	var req struct {
		AppointmentTime time.Time `json:"appointmentTime" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	loanColl := config.GetCollection("loans")
	objID, _ := primitive.ObjectIDFromHex(loanID)

	result, err := loanColl.UpdateOne(
		ctx,
		bson.M{"_id": objID, "memberId": user.ID, "status": "BORROWED"},
		bson.M{"$set": bson.M{"returnAppointment": req.AppointmentTime}},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule return"})
		return
	}
	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found or not in borrowed status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Return appointment scheduled successfully"})
}

// ConfirmPickup (Staff Only) - Transitions RESERVED -> BORROWED
func ConfirmPickup(c *gin.Context) {
	// Role Check
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	if user.Role != "ADMIN" && user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	loanID := c.Param("id")
	objID, _ := primitive.ObjectIDFromHex(loanID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	loanColl := config.GetCollection("loans")

	var loan models.Loan
	if err := loanColl.FindOne(ctx, bson.M{"_id": objID, "status": "RESERVED"}).Decode(&loan); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found or not in RESERVED status"})
		return
	}

	// Update Status RESERVED -> BORROWED
	update := bson.M{
		"$set": bson.M{
			"status":     "BORROWED",
			"borrowedAt": time.Now(),
			"dueDate":    time.Now().AddDate(0, 0, 14),
		},
	}

	_, err := loanColl.UpdateOne(
		ctx,
		bson.M{"_id": objID, "memberId": loan.MemberID, "bookId": loan.BookID, "branchId": loan.BranchID, "borrowedAt": loan.BorrowedAt},
		update,
	)

	if err != nil {
		fmt.Printf("UpdateOne Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm pickup"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pickup confirmed. Book is now BORROWED."})
}

// GetAllLoans (Staff Only) - Returns all loans with Member and Book details
func GetAllLoans(c *gin.Context) {
	// Role Check
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	if user.Role != "ADMIN" && user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	status := c.Query("status")
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: filter}},
		{{Key: "$sort", Value: bson.M{"borrowedAt": -1}}}, // Newest first
		{{Key: "$limit", Value: 100}}, // Limit to last 100 to prevent timeout
		{{Key: "$lookup", Value: bson.M{
			"from":         "books",
			"localField":   "bookId",
			"foreignField": "_id",
			"as":           "book",
		}}},
		{{Key: "$unwind", Value: "$book"}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "members",
			"localField":   "memberId",
			"foreignField": "_id",
			"as":           "member",
		}}},
		{{Key: "$unwind", Value: "$member"}},
	}

	cursor, err := config.GetCollection("loans").Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch loans"})
		return
	}
	defer cursor.Close(ctx)

	// Custom struct to include Member details
	type LoanWithMember struct {
		LoanPopulated `bson:",inline"`
		Member        struct {
			FullName string `bson:"fullName" json:"fullName"`
			Email    string `bson:"email" json:"email"`
		} `bson:"member" json:"member"`
	}

	var loans []LoanWithMember
	loans = []LoanWithMember{}

	if err = cursor.All(ctx, &loans); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Decoding error"})
		return
	}

	c.JSON(http.StatusOK, loans)
}
