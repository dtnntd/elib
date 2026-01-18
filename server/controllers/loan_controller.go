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

	// 2.2 Load System Policy (Strict Decoding)
	var policyWrapper struct {
		Value models.PolicyValue `bson:"value"`
	}
	sysColl := config.GetCollection("system_config")
	err := sysColl.FindOne(ctx, bson.M{"key": "LOAN_POLICY"}).Decode(&policyWrapper)

	// Determine Role Policy
	rolePolicy := models.RolePolicy{MaxPhysical: 2, MaxDigitalUnlimited: 5, MaxDigitalOCOU: 1} // Default

	if err == nil {
		if user.Subscription.Plan == "VIP" || user.Role == "VIP" || user.Role == "ADMIN" || user.Role == "STAFF" {
			rolePolicy = policyWrapper.Value.VIP
		} else {
			rolePolicy = policyWrapper.Value.Basic
		}
	} else {
		// Fallback
		if user.Subscription.Plan == "VIP" || user.Role == "VIP" || user.Role == "ADMIN" || user.Role == "STAFF" {
			rolePolicy = models.RolePolicy{MaxPhysical: 10, MaxDigitalUnlimited: -1, MaxDigitalOCOU: 10}
		}
	}

	// 2.3 Check Duplicate Active Loan
	duplicateCount, _ := loanColl.CountDocuments(ctx, bson.M{
		"memberId": user.ID,
		"bookId":   bookObjID,
		"itemType": req.Type,
		"status":   bson.M{"$in": []string{"BORROWED", "ACTIVE", "OVERDUE", "RESERVED"}}, 
	})
	
	if duplicateCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "You already have an active loan for this book"})
		return
	}

	if req.Type == "PHYSICAL" {
		// Check Physical Quota
		activeLoans, _ := loanColl.CountDocuments(ctx, bson.M{
			"memberId": user.ID,
			"status":   bson.M{"$in": []string{"BORROWED", "OVERDUE", "RESERVED"}},
			"itemType": "PHYSICAL",
		})
		
		if int(activeLoans) >= rolePolicy.MaxPhysical {
			c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Physical loan limit reached (%d/%d)", activeLoans, rolePolicy.MaxPhysical)})
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
		pcColl := config.GetCollection("physical_copies")
		invColl := config.GetCollection("inventory")

		// Find Available PHYSICAL COPY in User's Branch
		var copyDoc models.PhysicalCopy
		
		err := pcColl.FindOneAndUpdate(
			ctx,
			bson.M{"bookId": bookObjID, "branchId": user.BranchID, "status": "AVAILABLE"},
			bson.M{"$set": bson.M{"status": "RESERVED"}}, // Mark as RESERVED
		).Decode(&copyDoc)

		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusConflict, gin.H{"error": "No available copies in your branch"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
			return
		}

		// Decrement Inventory (Cache)
		// We fire-and-forget this update or handle error? Ideally transaction.
		// For now simple update.
		_, err = invColl.UpdateOne(
			ctx,
			bson.M{"bookId": bookObjID, "branchId": user.BranchID},
			bson.M{
				"$inc": bson.M{"availableCopies": -1},
				"$set": bson.M{"updatedAt": time.Now()},
			},
		)
		
		if err != nil {
			// CRITICAL: Inventory count inconsistent. 
			// Should revert Copy status.
			pcColl.UpdateOne(ctx, bson.M{"_id": copyDoc.ID}, bson.M{"$set": bson.M{"status": "AVAILABLE"}})
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update inventory cache"})
			return
		}

		// Create Loan
		loan := models.Loan{
			ID:                primitive.NewObjectID(),
			MemberID:          user.ID,
			BookID:            bookObjID,
			CopyID:            copyDoc.ID,    // Link to concrete copy
			BranchID:          user.BranchID,
			ItemType:          "PHYSICAL",
			Status:            "RESERVED",     // Initial status
			BorrowedAt:        time.Now(),
			PickupAppointment: req.PickupAppointment,
		}

		_, err = config.GetCollection("loans").InsertOne(ctx, loan)
		if err != nil {
			// Rollback everything
			pcColl.UpdateOne(ctx, bson.M{"_id": copyDoc.ID}, bson.M{"$set": bson.M{"status": "AVAILABLE"}})
			invColl.UpdateOne(ctx, bson.M{"bookId": bookObjID, "branchId": user.BranchID}, bson.M{"$inc": bson.M{"availableCopies": 1}})
			
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create loan record"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "Book reserved successfully. Please pick up at your appointment time.", "loan": loan})

	} else if req.Type == "DIGITAL" {
		// 4. DIGITAL LOGIC
		
		// 4.1 Check License Type (OCOU vs UNLIMITED)
		var license struct {
			AccessModel     string `bson:"accessModel"`     // "OCOU" or "UNLIMITED"
			ConcurrentLimit int    `bson:"concurrentLimit"`
		}
		
		licErr := config.GetCollection("digital_licenses").FindOne(ctx, bson.M{"bookId": bookObjID}).Decode(&license)
		
		// Default to UNLIMITED if no license found (or handle as error depending on policy)
		if licErr != nil {
			license.AccessModel = "UNLIMITED"
		}

		// 4.2 Check User Quota
		
		// Distinction: Do we count OCOU vs Unlimited separately against user quota?
		// Plan says we do.
		// Issue: How do we know which active loans are OCOU vs Unlimited to count them?
		// WE DON'T store accessModel on Loan. We'd have to lookup.
		// SIMPLIFICATION: User Quota applies to ALL Digital Books?
		// Plan Spec: "MaxDigitalUnlimited" and "MaxDigitalOCOU".
		// To implement strictly, we need to know the type of existing loans.
		// Costly query: Loop loans -> Lookup Book/License -> Count.
		
		// OPTIMIZATION: Just count ALL active digital loans against the MaxDigitalUnlimited (if -1 ignore).
		// For OCOU, check strictly.
		// Let's implement Strict Check or Loose Check?
		// "MaxDigitalUnlimited: 5" -> User can have 5 unlimited books.
		// "MaxDigitalOCOU: 1" -> User can have 1 OCOU book.
		
		// We need to count existing OCOU loans.
		// Aggregation is best here.
		
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{"memberId": user.ID, "itemType": "DIGITAL", "status": "ACTIVE"}}},
			{{Key: "$lookup", Value: bson.M{
				"from": "digital_licenses",
				"localField": "bookId",
				"foreignField": "bookId",
				"as": "license",
			}}},
			// If license missing, default unlimited?
			{{Key: "$project", Value: bson.M{
				"accessModel": bson.M{"$ifNull": []interface{}{bson.M{"$first": "$license.accessModel"}, "UNLIMITED"}},
			}}},
			{{Key: "$group", Value: bson.M{
				"_id": "$accessModel",
				"count": bson.M{"$sum": 1},
			}}},
		}
		
		cursor, _ := loanColl.Aggregate(ctx, pipeline)
		var counts []struct {
			ID    string `bson:"_id"`
			Count int    `bson:"count"`
		}
		cursor.All(ctx, &counts)
		
		activeOCOU := 0
		activeUnlimited := 0
		
		for _, c := range counts {
			if c.ID == "OCOU" {
				activeOCOU = c.Count
			} else {
				activeUnlimited += c.Count
			}
		}

		// Check Quota
		if license.AccessModel == "OCOU" {
			if activeOCOU >= rolePolicy.MaxDigitalOCOU {
				c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("You can only borrow %d Limited Access (OCOU) book(s) at a time", rolePolicy.MaxDigitalOCOU)})
				return
			}
			
			// 4.3 Check Book Concurrency Limit (Global)
			globalActive, _ := loanColl.CountDocuments(ctx, bson.M{
				"bookId":   bookObjID,
				"itemType": "DIGITAL",
				"status":   "ACTIVE",
			})
			
			if int(globalActive) >= license.ConcurrentLimit {
				c.JSON(http.StatusConflict, gin.H{"error": "All digital copies are currently in use. Please try again later."})
				return
			}
			
		} else {
			// UNLIMITED
			if rolePolicy.MaxDigitalUnlimited != -1 && activeUnlimited >= rolePolicy.MaxDigitalUnlimited {
				c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("You reached your E-book limit (%d)", rolePolicy.MaxDigitalUnlimited)})
				return
			}
		}
		
		// Create Loan
		loan := models.Loan{
			ID:         primitive.NewObjectID(),
			MemberID:   user.ID,
			BookID:     bookObjID,
			BranchID:   user.BranchID,
			ItemType:   "DIGITAL",
			Status:     "ACTIVE",
			BorrowedAt: time.Now(),
			DueDate:    time.Now().AddDate(0, 0, 14), // 2 weeks default
		}
		
		_, err := config.GetCollection("loans").InsertOne(ctx, loan)
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
	BorrowedAt      *time.Time          `bson:"borrowedAt" json:"borrowedAt"`
	DueDate         *time.Time          `bson:"dueDate" json:"dueDate"`
	ReturnedAt      *time.Time          `bson:"returnedAt" json:"returnedAt"`
	FineAmount      int                `bson:"fineAmount" json:"fineAmount"`
	ReturnCondition string             `bson:"returnCondition" json:"returnCondition"`
	PickupAppointment *time.Time       `bson:"pickupAppointment" json:"pickupAppointment"`
	ReturnAppointment *time.Time       `bson:"returnAppointment" json:"returnAppointment"`
	Book            *models.Book       `bson:"book" json:"book"` // Populated (Pointer to handle null)
	AccessModel     string             `bson:"accessModel" json:"accessModel"`  // From lookup
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
		{{Key: "$unwind", Value: bson.M{"path": "$book", "preserveNullAndEmptyArrays": true}}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "digital_licenses",
			"localField":   "bookId",
			"foreignField": "bookId",
			"as":           "license",
		}}},
		// We use $addFields to extract accessModel efficiently without unwinding (license might be null)
		{{Key: "$addFields", Value: bson.M{
			"accessModel": bson.M{"$ifNull": []interface{}{bson.M{"$arrayElemAt": []interface{}{"$license.accessModel", 0}}, "UNLIMITED"}},
		}}},
		{{Key: "$project", Value: bson.M{"license": 0}}},
	}
	
	cursor, err := config.GetCollection("loans").Aggregate(ctx, pipeline)
	if err != nil {
		fmt.Printf("GetMyLoans Aggregation Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch loans"})
		return
	}
	defer cursor.Close(ctx)

	var loans []LoanPopulated
	// Default to empty slice to avoid null in JSON
	loans = []LoanPopulated{} 
	
	if err = cursor.All(ctx, &loans); err != nil {
		fmt.Printf("GetMyLoans Decoding Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Decoding error"})
		return
	}

	// Handle nil books (deleted books)
	for i := range loans {
		if loans[i].Book == nil {
			loans[i].Book = &models.Book{Title: "Unknown / Deleted Book"}
		}
	}

	c.JSON(http.StatusOK, loans)
}

// ReturnBook handles returning a book (Physical or Digital)
func ReturnBook(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	loanID := c.Param("id")

	var req struct {
		Condition string `json:"condition"` // GOOD, DAMAGED, LOST
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Condition == "" {
		req.Condition = "GOOD" // Default
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	loanColl := config.GetCollection("loans")
	objID, _ := primitive.ObjectIDFromHex(loanID)

	// 1. Find Loan & Verify Ownership
	var loan models.Loan
	filter := bson.M{
		"_id":    objID,
		"status": bson.M{"$in": []string{"BORROWED", "ACTIVE", "OVERDUE"}},
	}
	
	// If NOT Staff/Admin, ensure they can only return their own books
	if user.Role != "STAFF" && user.Role != "ADMIN" {
		filter["memberId"] = user.ID
	}

	err := loanColl.FindOne(ctx, filter).Decode(&loan)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found or already returned"})
		return
	}

	// 2. Helper Update Fields
	updateFields := bson.M{
		"status":          "RETURNED",
		"returnedAt":      time.Now(),
		"returnCondition": req.Condition,
	}

	// 3. Handle Physical vs Digital Specifics
	fine := 0
	if loan.ItemType == "PHYSICAL" {
		
		// 3.1 Calculate Overdue Fine (Waived for Admin/Staff)
		if user.Role != "ADMIN" && user.Role != "STAFF" {
			if time.Now().After(loan.DueDate) {
				daysOverdue := int(time.Since(loan.DueDate).Hours() / 24)
				if daysOverdue > 0 {
					fine += daysOverdue * 5000 // 5k VND per day
				}
			}
		}

		// 3.2 Handle Condition
		if req.Condition == "DAMAGED" {
			fine += 50000 // Flat damage fee
		} else if req.Condition == "LOST" {
			// Fetch Book Price
			var book models.Book
			config.GetCollection("books").FindOne(ctx, bson.M{"_id": loan.BookID}).Decode(&book)
			if book.Price > 0 {
				fine += book.Price
			} else {
				fine += 100000 // Default if price missing
			}
		}

		updateFields["fineAmount"] = fine

	} else {
		// Digital: Just mark returned
	}
	
	// 4. Update Loan Record (Include Shard Key for safe update)
	result, err := loanColl.UpdateOne(
		ctx, 
		bson.M{"_id": objID, "branchId": loan.BranchID, "borrowedAt": loan.BorrowedAt}, 
		bson.M{"$set": updateFields},
	)
	if err != nil {
		fmt.Printf("UpdateOne Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to return book"})
		return
	}
	
	if result.MatchedCount == 0 {
		fmt.Printf("[ReturnBook] Failed to match doc %s. Shard Key mismatch?\n", objID.Hex())
		c.JSON(http.StatusNotFound, gin.H{"error": "Return failed: Loan not found or shard key mismatch"})
		return
	}

	// 5. Update Inventory & Physical Copy
	if loan.ItemType == "PHYSICAL" && req.Condition != "LOST" {
		invColl := config.GetCollection("inventory")
		pcColl := config.GetCollection("physical_copies")
		
		// Update Copy Status
		if loan.CopyID != primitive.NilObjectID {
			_, err := pcColl.UpdateOne(ctx, bson.M{"_id": loan.CopyID}, bson.M{"$set": bson.M{"status": "AVAILABLE"}})
			if err != nil {
				fmt.Printf("Error restoring copy status %s: %v\n", loan.CopyID, err)
			}
		}

		// Increment Inventory Cache
		_, err := invColl.UpdateOne(
			ctx, 
			bson.M{"bookId": loan.BookID, "branchId": loan.BranchID}, 
			bson.M{
				"$inc": bson.M{"availableCopies": 1},
				"$set": bson.M{"updatedAt": time.Now()},
			},
		)
		if err != nil {
			// Should log critical error here as inventory is now out of sync
			fmt.Printf("CRITICAL: Failed to restore inventory for loan %s: %v\n", loanID, err)
		}
	}

	// 6. Process Fine (Deduct Wallet & Log Transaction)
	if fine > 0 {
		memberColl := config.GetCollection("members")
		transColl := config.GetCollection("transactions")

		// Deduct from Wallet
		memberColl.UpdateOne(ctx, bson.M{"_id": loan.MemberID}, bson.M{"$inc": bson.M{"walletBalance": -fine}})

		// Create Transaction
		transaction := models.Transaction{
			ID:          primitive.NewObjectID(),
			MemberID:    loan.MemberID,
			Amount:      -fine,
			Type:        "FINE",
			Description: fmt.Sprintf("Fine for loan %s (%s)", loanID, req.Condition),
			CreatedAt:   time.Now(),
		}
		transColl.InsertOne(ctx, transaction)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Book returned successfully", "fine": fine})
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

	// 1. Fetch Loan first to check existence
	var loan models.Loan
	err := loanColl.FindOne(ctx, bson.M{"_id": objID}).Decode(&loan)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found"})
		return
	}

	// 2. Validate Ownership (If NOT Admin/Staff)
	if user.Role != "ADMIN" && user.Role != "STAFF" {
		if loan.MemberID != user.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only schedule returns for your own books"})
			return
		}
	}

	// 3. Validate Status
	if loan.Status != "BORROWED" && loan.Status != "OVERDUE" {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Cannot schedule return for book in '%s' status", loan.Status)})
		return
	}

	// 4. Perform Update
	_, err = loanColl.UpdateOne(
		ctx,
		bson.M{"_id": objID},
		bson.M{"$set": bson.M{"returnAppointment": req.AppointmentTime}},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save appointment"})
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

	// Find RESERVED loan
	// Use bson.M to capture EXACT Shard Key values (especially borrowedAt) without Type Conversion loss
	var rawLoan bson.M
	if err := loanColl.FindOne(ctx, bson.M{"_id": objID, "status": "RESERVED"}).Decode(&rawLoan); err != nil {
		fmt.Printf("[ConfirmPickup] FindOne failed for %s: %v\n", objID.Hex(), err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found (or not RESERVED)"})
		return
	}

	// Decode to Struct for Logic
	var loan LoanPopulated
	bsonBytes, _ := bson.Marshal(rawLoan)
	bson.Unmarshal(bsonBytes, &loan)

	// 2. Update Status to BORROWED
	update := bson.M{
		"$set": bson.M{
			"status":     "BORROWED",
			"borrowedAt": time.Now(),
			"dueDate":    time.Now().AddDate(0, 0, 14), // 2 weeks
		},
		"$unset": bson.M{"pickupAppointment": ""},
	}

	// Filter MUST include Shard Key {branchId, borrowedAt}.
	// Use RAW values from DB to guarantee match
	shardFilter := bson.M{
		"_id":        objID,
		"branchId":   rawLoan["branchId"],
		"borrowedAt": rawLoan["borrowedAt"],
	}

	fmt.Printf("[ConfirmPickup] Updating %s with ShardKey: branch=%v, borrowed=%v\n", objID.Hex(), rawLoan["branchId"], rawLoan["borrowedAt"])

	result, err := loanColl.UpdateOne(ctx, shardFilter, update)

	if err != nil {
		fmt.Printf("UpdateOne Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm pickup"})
		return
	}

	if result.MatchedCount == 0 {
		fmt.Printf("[ConfirmPickup] Failed to match doc %s. Filter: branch=%s, borrowedAt=nil\n", objID.Hex(), loan.BranchID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Update failed: Loan not found or shard key mismatch"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pickup confirmed. Book is now BORROWED."})
}

// RenewLoan (Staff/Admin) - Extends due date
func RenewLoan(c *gin.Context) {
	// Role Check: Admin/Staff OR Owner
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	loanID := c.Param("id")
	objID, _ := primitive.ObjectIDFromHex(loanID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	loanColl := config.GetCollection("loans")

	var loan models.Loan
	if err := loanColl.FindOne(ctx, bson.M{"_id": objID}).Decode(&loan); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Loan not found"})
		return
	}

	// Permission Check
	if user.Role != "ADMIN" && user.Role != "STAFF" && user.ID != loan.MemberID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
		return
	}

	// Logic: Extend 14 days from NOW (or from current due date?)
	// Common policy: Extend from now if overdue, or add to existing if not.
	// Let's keep it simple: New Due Date = Now + 14 Days
	newDueDate := time.Now().AddDate(0, 0, 14)

	update := bson.M{
		"$set": bson.M{
			"dueDate": newDueDate,
			"status":  "BORROWED", // Reset status if it was OVERDUE
		},
	}

	_, err := loanColl.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to renew loan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Loan renewed successfully",
		"newDueDate": newDueDate,
	})
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
	limit := 100 // Default limit

	if status != "" {
		if status == "OVERDUE" {
			// Find loans that are explicitly OVERDUE OR (BORROWED/ACTIVE and DueDate < Now)
			filter = bson.M{
				"$or": []bson.M{
					{"status": "OVERDUE"},
					{
						"status":  bson.M{"$in": []string{"BORROWED", "ACTIVE"}},
						"dueDate": bson.M{"$lt": time.Now()},
					},
				},
			}
			limit = 1000 // Increase limit significantly for overdue to ensure they are seen
		} else if status == "SCHEDULED" {
			// Find active loans (not RETURNED) that have a returnAppointment
			filter = bson.M{
				"returnAppointment": bson.M{"$ne": nil},
				"status":            bson.M{"$ne": "RETURNED"},
			}
			limit = 1000
		} else if status == "CURRENT" {
			// Find ALL active loans (Borrowed + Overdue)
			filter = bson.M{
				"status": bson.M{"$in": []string{"BORROWED", "OVERDUE", "ACTIVE"}},
			}
			limit = 1000
		} else {
			filter["status"] = status
		}
	}

    skip := 0

	// 1.5 Branch Filtering (Staff Only)
	if user.Role == "STAFF" {
		filter["branchId"] = user.BranchID
	}

	// Sort Query
	sortBy := c.DefaultQuery("sortBy", "borrowedAt")
	order := c.DefaultQuery("order", "desc")
	sortDir := -1
	if order == "asc" {
		sortDir = 1
	}

	sortStage := bson.D{{Key: sortBy, Value: sortDir}}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Optimization: If sorting by native fields, put Sort/Limit BEFORE Lookups
	// Native fields: borrowedAt, dueDate, status, returnedAt
	isNativeSort := true
	if sortBy == "book.title" || sortBy == "member.fullName" {
		isNativeSort = false
	}
	
	// FIX: For RESERVED loans, borrowedAt is null (end of index).
	// Using Fast Path (Index Sort) causes a full index scan timeout. 
	// Force Slow Path (Match -> Lookup) to filter efficiently first.
	// NOTE: Disabled manually to debug empty list issue. DB seems small enough or logic flawed.
	// if filter["status"] == "RESERVED" {
	// 	isNativeSort = false
	// }

	pipeline := mongo.Pipeline{}

	// 1. Match
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: filter}})

	// 2. Sort & Limit (If Native - FAST PATH)
	if isNativeSort {
		pipeline = append(pipeline, bson.D{{Key: "$sort", Value: sortStage}})
		pipeline = append(pipeline, bson.D{{Key: "$skip", Value: skip}})
		pipeline = append(pipeline, bson.D{{Key: "$limit", Value: limit}})
	}

	// 3. Lookups (Expensive)
	pipeline = append(pipeline, bson.D{{Key: "$lookup", Value: bson.M{
		"from":         "books",
		"localField":   "bookId",
		"foreignField": "_id",
		"as":           "book",
	}}})
	pipeline = append(pipeline, bson.D{{Key: "$unwind", Value: bson.M{"path": "$book", "preserveNullAndEmptyArrays": true}}})

	pipeline = append(pipeline, bson.D{{Key: "$lookup", Value: bson.M{
		"from":         "members",
		"localField":   "memberId",
		"foreignField": "_id",
		"as":           "member",
	}}})
	pipeline = append(pipeline, bson.D{{Key: "$unwind", Value: bson.M{"path": "$member", "preserveNullAndEmptyArrays": true}}})

	// 4. Sort & Limit (If Non-Native - SLOW PATH)
	if !isNativeSort {
		pipeline = append(pipeline, bson.D{{Key: "$sort", Value: sortStage}})
		pipeline = append(pipeline, bson.D{{Key: "$limit", Value: limit}})
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
		fmt.Printf("Cursor Decode Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error decoding loans: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, loans)
}

// GetMyQuota returns user's current loan usage vs policy limits
func GetMyQuota(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Get Policy
	// Define a wrapper to decode strictly into PolicyValue
	var policyWrapper struct {
		Value models.PolicyValue `bson:"value"`
	}

	sysColl := config.GetCollection("system_config")
	err := sysColl.FindOne(ctx, bson.M{"key": "LOAN_POLICY"}).Decode(&policyWrapper)

	// Determine Role Policy
	rolePolicy := models.RolePolicy{MaxPhysical: 2, MaxDigitalUnlimited: 5, MaxDigitalOCOU: 1} // Default Basic

	if err == nil {
		// Apply Policy from DB
		if user.Subscription.Plan == "VIP" || user.Role == "VIP" || user.Role == "ADMIN" || user.Role == "STAFF" {
			rolePolicy = policyWrapper.Value.VIP
		} else {
			rolePolicy = policyWrapper.Value.Basic
		}
		fmt.Printf("[DEBUG] Loaded Policy: VIP=%+v, RolePolicy=%+v\n", policyWrapper.Value.VIP, rolePolicy)
	} else {
		fmt.Printf("[DEBUG] Policy Load Error: %v. Using Fallback.\n", err)
		// Fallback defaults if DB config missing or error
		if user.Subscription.Plan == "VIP" || user.Role == "VIP" || user.Role == "ADMIN" || user.Role == "STAFF" {
			rolePolicy = models.RolePolicy{MaxPhysical: 10, MaxDigitalUnlimited: -1, MaxDigitalOCOU: 10}
		}
	}

	// 2. Count Active Physical Loans
	loanColl := config.GetCollection("loans")
	physicalCount, _ := loanColl.CountDocuments(ctx, bson.M{
		"memberId": user.ID,
		"itemType": "PHYSICAL",
		"status":   bson.M{"$in": []string{"BORROWED", "OVERDUE", "RESERVED"}},
	})

	// 3. Count Active Digital Loans (Group by Access Model)
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"memberId": user.ID, "itemType": "DIGITAL", "status": "ACTIVE"}}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "digital_licenses",
			"localField":   "bookId",
			"foreignField": "bookId",
			"as":           "license",
		}}},
		{{Key: "$project", Value: bson.M{
			"accessModel": bson.M{"$ifNull": []interface{}{bson.M{"$first": "$license.accessModel"}, "UNLIMITED"}},
		}}},
		{{Key: "$group", Value: bson.M{
			"_id": "$accessModel",
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, _ := loanColl.Aggregate(ctx, pipeline)
	var counts []struct {
		ID    string `bson:"_id"`
		Count int    `bson:"count"`
	}
	cursor.All(ctx, &counts)

	digitalUnlimited := 0
	digitalOCOU := 0

	for _, c := range counts {
		if c.ID == "OCOU" {
			digitalOCOU = c.Count
		} else {
			digitalUnlimited += c.Count
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"policy": rolePolicy,
		"usage": gin.H{
			"physical":         physicalCount,
			"digitalUnlimited": digitalUnlimited,
			"digitalOCOU":      digitalOCOU,
		},
		"plan": user.Subscription.Plan,
	})
}
