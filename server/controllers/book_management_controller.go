package controllers

import (
	"context"
	"net/http"
	"time"

	"elibrary-api/config"
	"elibrary-api/models"

	"github.com/gin-gonic/gin"
	"fmt"
	"strings"
	"strconv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ============= ADMIN ENDPOINTS =============

type AddBookRequest struct {
	ISBN          string   `json:"isbn" binding:"required"`
	Title         string   `json:"title" binding:"required"`
	Authors       []string `json:"authors" binding:"required"`
	Subjects      []string `json:"subjects"`
	LCCCode       string   `json:"lccCode"`
	Publisher     string   `json:"publisher"`
	PublishedYear int      `json:"publishedYear"`
	Price         int      `json:"price"`
	Lang          string   `json:"lang"`
	Description   string   `json:"description"`
	// Digital License
	HasDigital      bool   `json:"hasDigital"`
	AccessModel     string `json:"accessModel"`     // "OCOU" or "UNLIMITED"
	ConcurrentLimit int    `json:"concurrentLimit"` // Only if OCOU
}

// AddBook - Admin only
func AddBook(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var req AddBookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if ISBN already exists
	booksColl := config.GetCollection("books")
	count, _ := booksColl.CountDocuments(context.TODO(), bson.M{"isbn": req.ISBN})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Book with this ISBN already exists"})
		return
	}

	newBook := models.Book{
		ID:            primitive.NewObjectID(),
		ISBN:          req.ISBN,
		Title:         req.Title,
		Authors:       req.Authors,
		Subjects:      req.Subjects,
		LCCCode:       req.LCCCode,
		Publisher:     req.Publisher,
		PublishedYear: req.PublishedYear,
		Price:         req.Price,
		Lang:          req.Lang,
		Description:   req.Description,
	}

	_, err := booksColl.InsertOne(context.TODO(), newBook)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add book"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Book added successfully",
		"bookId":  newBook.ID.Hex(),
	})
	
	// Handle Digital License
	handleDigitalLicense(context.TODO(), newBook.ID, req)
}

// UpdateBook - Admin only
func UpdateBook(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	bookID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(bookID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	var req AddBookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"title":         req.Title,
			"authors":       req.Authors,
			"subjects":      req.Subjects,
			"lccCode":       req.LCCCode,
			"publisher":     req.Publisher,
			"publishedYear": req.PublishedYear,
			"price":         req.Price,
			"lang":          req.Lang,
			"description":   req.Description,
		},
	}

	booksColl := config.GetCollection("books")
	result, err := booksColl.UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil || result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Book not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Book updated successfully"})

	// Handle Digital License
	handleDigitalLicense(context.TODO(), objID, req)
}

// Helper to update license
func handleDigitalLicense(ctx context.Context, bookID primitive.ObjectID, req AddBookRequest) {
	licColl := config.GetCollection("digital_licenses")
	
	if req.HasDigital {
		filter := bson.M{"bookId": bookID}
		update := bson.M{
			"$set": bson.M{
				"accessModel":     req.AccessModel,
				"concurrentLimit": req.ConcurrentLimit,
				"vendor":          "Self-Hosted", // Default or add to req
			},
		}
		opts := options.Update().SetUpsert(true)
		licColl.UpdateOne(ctx, filter, update, opts)
	} else {
		// If disabled, maybe remove license? Or keep as inactive?
		// For now, if user unchecks "Has E-book", we remove the license record to stop digital borrowing.
		licColl.DeleteOne(ctx, bson.M{"bookId": bookID})
	}
}

// DeleteBook - Admin only
func DeleteBook(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	bookID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(bookID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	booksColl := config.GetCollection("books")
	result, err := booksColl.DeleteOne(context.TODO(), bson.M{"_id": objID})
	if err != nil || result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Book not found"})
		return
	}

	// Also delete all inventory records for this book
	invColl := config.GetCollection("inventory")
	invColl.DeleteMany(context.TODO(), bson.M{"bookId": objID})

	// Also delete license
	config.GetCollection("digital_licenses").DeleteOne(context.TODO(), bson.M{"bookId": objID})

	c.JSON(http.StatusOK, gin.H{"message": "Book deleted successfully"})
}

// GetBookLicense - Admin only
func GetBookLicense(c *gin.Context) {
	// Auth check skipped (assumed Admin route)
	
	bookID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(bookID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	var license struct {
		AccessModel     string `bson:"accessModel" json:"accessModel"`
		ConcurrentLimit int    `bson:"concurrentLimit" json:"concurrentLimit"`
	}
	
	err = config.GetCollection("digital_licenses").FindOne(context.TODO(), bson.M{"bookId": objID}).Decode(&license)
	
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// No license (Not activated)
			c.JSON(http.StatusOK, gin.H{"hasDigital": false})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch license"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"hasDigital":      true,
		"accessModel":     license.AccessModel,
		"concurrentLimit": license.ConcurrentLimit,
	})
}

// GetBookPhysicalCopies - Admin only
func GetBookPhysicalCopies(c *gin.Context) {
	bookID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(bookID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	var copies []models.PhysicalCopy
	pcColl := config.GetCollection("physical_copies")
	
	// Sort by Barcode ASC
	opts := options.Find().SetSort(bson.M{"barcode": 1})
	cursor, err := pcColl.Find(context.TODO(), bson.M{"bookId": objID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch copies"})
		return
	}
	if err = cursor.All(context.TODO(), &copies); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode copies"})
		return
	}

	c.JSON(http.StatusOK, copies)
}



type UpdatePhysicalCopyRequest struct {
	Status    string `json:"status" binding:"required"` // AVAILABLE, LOST, DAMAGED
	Condition string `json:"condition"`
}

// UpdatePhysicalCopy - Admin (Any) or Staff (Own Branch)
func UpdatePhysicalCopy(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	copyID := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(copyID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid copy ID"})
		return
	}

	var req UpdatePhysicalCopyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pcColl := config.GetCollection("physical_copies")
	
	// Check coverage/permission
	var copy models.PhysicalCopy
	err = pcColl.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&copy)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physical copy not found"})
		return
	}

	// Permission Check
	if user.Role == "STAFF" && copy.BranchID != user.BranchID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update copies in your branch"})
		return
	}

	// Update
	update := bson.M{
		"$set": bson.M{
			"status":    req.Status,
			"condition": req.Condition,
			"updatedAt": time.Now(),
		},
	}
	
	_, err = pcColl.UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update copy"})
		return
	}

	// If status changed to LOST/DAMAGED (from AVAILABLE) or Vice Versa, we might need to update Inventory Count?
	// For now, Inventory.AvailableCopies tracks "Effective" availability. 
	// If a book is LOST, it is NO LONGER AVAILABLE. 
	// We need to sync Inventory.AvailableCopies.
	
	// Logic:
	// If OldStatus == AVAILABLE and NewStatus != AVAILABLE -> AvailableCopies--
	// If OldStatus != AVAILABLE and NewStatus == AVAILABLE -> AvailableCopies++
	
	if copy.Status == "AVAILABLE" && req.Status != "AVAILABLE" {
		// Decrease Available
		adjustInventoryAvailability(context.TODO(), copy.BookID, copy.BranchID, -1)
	} else if copy.Status != "AVAILABLE" && req.Status == "AVAILABLE" {
		// Increase Available
		adjustInventoryAvailability(context.TODO(), copy.BookID, copy.BranchID, 1)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Copy updated successfully"})
}

func adjustInventoryAvailability(ctx context.Context, bookID primitive.ObjectID, branchID string, diff int) {
	invColl := config.GetCollection("inventory")
	invColl.UpdateOne(ctx, bson.M{
		"bookId":   bookID,
		"branchId": branchID,
	}, bson.M{
		"$inc": bson.M{"availableCopies": diff},
	})
}

type AddInventoryRequest struct {
	BookID      string `json:"bookId" binding:"required"`
	BranchID    string `json:"branchId" binding:"required"`
	TotalCopies int    `json:"totalCopies" binding:"required,min=0"`
}

// AddInventory - Admin only
func AddInventory(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var req AddInventoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bookObjID, err := primitive.ObjectIDFromHex(req.BookID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	invColl := config.GetCollection("inventory")

	// Check if inventory already exists for this book+branch
	var existingInv models.Inventory
	err = invColl.FindOne(context.TODO(), bson.M{
		"bookId":   bookObjID,
		"branchId": req.BranchID,
	}).Decode(&existingInv)

	var currentTotal int
	if err == nil {
		currentTotal = existingInv.TotalCopies
	} else {
		currentTotal = 0
	}

	diff := req.TotalCopies - currentTotal

	if diff == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No changes to inventory"})
		return
	}

	// Adjust Physical Copies
	if err := adjustPhysicalCopies(context.TODO(), bookObjID, req.BranchID, diff); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err == nil {
		// Update existing inventory
		// IMPORTANT: Only update Quantities by DIFF, do not reset Available to Total
		update := bson.M{
			"$inc": bson.M{
				"totalCopies": diff,
				"availableCopies": diff, // Assuming new copies are available, removed copies reduce availability
			},
			"$set": bson.M{
				"updatedAt": time.Now(),
				"updatedBy": user.ID,
			},
		}
		invColl.UpdateOne(context.TODO(), bson.M{"_id": existingInv.ID}, update)
	} else {
		// Create new inventory
		newInv := models.Inventory{
			ID:              primitive.NewObjectID(),
			BookID:          bookObjID,
			BranchID:        req.BranchID,
			TotalCopies:     req.TotalCopies,
			AvailableCopies: req.TotalCopies,
			UpdatedAt:       time.Now(),
			UpdatedBy:       user.ID,
		}
		invColl.InsertOne(context.TODO(), newInv)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Inventory updated successfully"})
}

// GetInventory - Admin/Staff
func GetInventory(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	if user.Role != "ADMIN" && user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff or Admin access required"})
		return
	}

	invColl := config.GetCollection("inventory")

	// Build filter
	filter := bson.M{}
	if user.Role == "STAFF" {
		// Staff only see their branch
		filter["branchId"] = user.BranchID
	}

	cursor, err := invColl.Find(context.TODO(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory"})
		return
	}
	defer cursor.Close(context.TODO())

	inventory := []models.Inventory{}
	if err = cursor.All(context.TODO(), &inventory); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode inventory"})
		return
	}

	c.JSON(http.StatusOK, inventory)
}

// ============= STAFF ENDPOINTS =============

type UpdateInventoryRequest struct {
	Action   string `json:"action" binding:"required"` // "add" or "remove"
	Quantity int    `json:"quantity" binding:"required,min=1"`
}

// UpdateInventory - Staff only (own branch)
func UpdateInventory(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	if user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	bookID := c.Param("bookId")
	bookObjID, err := primitive.ObjectIDFromHex(bookID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid book ID"})
		return
	}

	var req UpdateInventoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invColl := config.GetCollection("inventory")

	// Find inventory for this book at staff's branch
	var inv models.Inventory
	err = invColl.FindOne(context.TODO(), bson.M{
		"bookId":   bookObjID,
		"branchId": user.BranchID,
	}).Decode(&inv)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Inventory not found for this book at your branch"})
		return
	}

	// Calculate diff
	var diff int
	if req.Action == "add" {
		diff = req.Quantity
	} else if req.Action == "remove" {
		diff = -req.Quantity
		if inv.AvailableCopies < req.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove more than available copies"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action"})
		return
	}

	// Adjust Physical Copies
	if err := adjustPhysicalCopies(context.TODO(), bookObjID, user.BranchID, diff); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update physical copies: " + err.Error()})
		return
	}

	// Update inventory
	update := bson.M{
		"$inc": bson.M{
			"totalCopies":     diff,
			"availableCopies": diff,
		},
		"$set": bson.M{
			"updatedAt":       time.Now(),
			"updatedBy":       user.ID,
		},
	}

	_, err = invColl.UpdateOne(context.TODO(), bson.M{"_id": inv.ID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update inventory"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Inventory updated successfully",
		"newTotal":         inv.TotalCopies + diff,
		"newAvailable":     inv.AvailableCopies + diff,
	})
}

// Helper to sync Physical Copies
func adjustPhysicalCopies(ctx context.Context, bookID primitive.ObjectID, branchID string, diff int) error {
	pcColl := config.GetCollection("physical_copies")
	
	if diff > 0 {
		// ADD NEW COPIES
		
		// 1. Get Book info for ISBN
		var book models.Book
		err := config.GetCollection("books").FindOne(ctx, bson.M{"_id": bookID}).Decode(&book)
		if err != nil {
			return fmt.Errorf("book not found")
		}

		// 2. Find current max sequence for this book+branch to generate barcode
		// Barcode format: {ISBN}-{Branch}-{Seq}
		// We can just count total copies created/sequence? 
		// Best way: regex search for max barcode? Or simple count if we trust sequential.
		// Safe way: Find latest created copy.
		
		opts := options.FindOne().SetSort(bson.M{"barcode": -1})
		regex := fmt.Sprintf("^%s-%s-", book.ISBN, branchID)
		
		var lastCopy models.PhysicalCopy
		err = pcColl.FindOne(ctx, bson.M{
			"barcode": bson.M{"$regex": regex},
		}, opts).Decode(&lastCopy)

		lastSeq := 0
		if err == nil {
			parts := strings.Split(lastCopy.Barcode, "-")
			if len(parts) >= 3 {
				lastSeq, _ = strconv.Atoi(parts[len(parts)-1])
			}
		}

		// 3. Create N copies
		var newCopies []interface{}
		for i := 0; i < diff; i++ {
			seq := lastSeq + i + 1
			barcode := fmt.Sprintf("%s-%s-%03d", book.ISBN, branchID, seq)
			
			copy := models.PhysicalCopy{
				ID:        primitive.NewObjectID(),
				BookID:    bookID,
				BranchID:  branchID,
				Barcode:   barcode,
				Status:    "AVAILABLE",
				Condition: "GOOD",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			newCopies = append(newCopies, copy)
		}
		
		if len(newCopies) > 0 {
			_, err = pcColl.InsertMany(ctx, newCopies)
			return err
		}

	} else if diff < 0 {
		// REMOVE COPIES (Delete AVAILABLE ones)
		qtyToRemove := -diff
		
		// Find IDs of available copies to delete
		cursor, err := pcColl.Find(ctx, bson.M{
			"bookId":   bookID,
			"branchId": branchID,
			"status":   "AVAILABLE",
		}, options.Find().SetLimit(int64(qtyToRemove)))
		
		if err != nil {
			return err
		}
		
		var copies []models.PhysicalCopy
		if err = cursor.All(ctx, &copies); err != nil {
			return err
		}
		
		if len(copies) < qtyToRemove {
			return fmt.Errorf("not enough available copies to remove (Requested: %d, Available: %d)", qtyToRemove, len(copies))
		}
		
		idsToDelete := make([]primitive.ObjectID, len(copies))
		for i, c := range copies {
			idsToDelete[i] = c.ID
		}
		
		_, err = pcColl.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": idsToDelete}})
		return err
	}
	
	return nil
}
