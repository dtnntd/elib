package controllers

import (
	"context"
	"elibrary-api/config"
	"elibrary-api/models"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Custom Book Struct for List View with License Info
type BookWithLicense struct {
	models.Book `bson:",inline"`
	HasDigital  bool    `json:"hasDigital" bson:"hasDigital"`
	AccessModel string  `json:"accessModel" bson:"accessModel"`
	Score       float64 `json:"score,omitempty" bson:"score,omitempty"`
}

func GetBooks(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("books")

	// Query Params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "12"))
	search := c.Query("q")
	subject := c.Query("subject")
	author := c.Query("author")
	language := c.Query("language")
	yearStr := c.Query("year")

	matchStage := bson.M{}
	
	// Full Text Search Logic (Replaces Regex)
	if search != "" {
		matchStage["$text"] = bson.M{"$search": search}
	}
	if subject != "" {
		matchStage["subjects"] = subject
	}
	if author != "" {
		matchStage["authors"] = bson.M{"$regex": author, "$options": "i"}
	}
	if language != "" {
		matchStage["lang"] = language
	}
	if yearStr != "" {
		year, err := strconv.Atoi(yearStr)
		if err == nil {
			matchStage["publishedYear"] = year
		}
	}

	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: matchStage}},
	}

	// If searching, sort by relevance score
	if search != "" {
		pipeline = append(pipeline,
			bson.D{{Key: "$addFields", Value: bson.M{"score": bson.M{"$meta": "textScore"}}}},
			bson.D{{Key: "$sort", Value: bson.M{"score": bson.M{"$meta": "textScore"}}}},
		)
	}
	// Get bookType and branch filters
	bookType := c.Query("bookType") // "", "physical", "digital", "digital-OCOU", "digital-UNLIMITED"
	branch := c.Query("branch")     // "", "HN", "HP", "DN"

	// Determine if we need slow path (filter by type requires lookup first)
	needsTypeFilter := bookType != ""

	// Build pipeline based on whether we need to filter by book type
	if needsTypeFilter {
		// OPTIMIZED: Reverse lookup approach
		// Instead of lookup on 10k books, we get bookIds from copies/licenses first (indexed!)
		
		var bookIDs []primitive.ObjectID
		
		if bookType == "physical" {
			// Get distinct bookIds from physical_copies (indexed by branchId)
			copyFilter := bson.M{"status": bson.M{"$ne": "LOST"}}
			if branch != "" {
				copyFilter["branchId"] = branch
			}
			
			pcColl := config.GetCollection("physical_copies")
			bookIDsRaw, err := pcColl.Distinct(ctx, "bookId", copyFilter)
			if err == nil {
				for _, id := range bookIDsRaw {
					if oid, ok := id.(primitive.ObjectID); ok {
						bookIDs = append(bookIDs, oid)
					}
				}
			}
		} else {
			// Digital filters - get from digital_licenses (indexed by accessModel)
			licenseFilter := bson.M{}
			if bookType == "digital-OCOU" {
				licenseFilter["accessModel"] = "OCOU"
			} else if bookType == "digital-UNLIMITED" {
				licenseFilter["accessModel"] = "UNLIMITED"
			}
			
			dlColl := config.GetCollection("digital_licenses")
			bookIDsRaw, err := dlColl.Distinct(ctx, "bookId", licenseFilter)
			if err == nil {
				for _, id := range bookIDsRaw {
					if oid, ok := id.(primitive.ObjectID); ok {
						bookIDs = append(bookIDs, oid)
					}
				}
			}
		}
		
		// Add filter by bookIds to match stage
		if len(bookIDs) > 0 {
			matchStage["_id"] = bson.M{"$in": bookIDs}
		} else {
			// No matching books, return empty result fast
			c.JSON(http.StatusOK, gin.H{
				"data": []BookWithLicense{},
				"meta": gin.H{"total": 0, "totalPages": 0, "userPage": page, "limit": limit},
			})
			return
		}
		
		// Rebuild pipeline with updated matchStage
		pipeline = mongo.Pipeline{
			bson.D{{Key: "$match", Value: matchStage}},
		}
		
		// Re-add text search sort if needed
		if search != "" {
			pipeline = append(pipeline,
				bson.D{{Key: "$addFields", Value: bson.M{"score": bson.M{"$meta": "textScore"}}}},
				bson.D{{Key: "$sort", Value: bson.M{"score": bson.M{"$meta": "textScore"}}}},
			)
		}
		
		// Use fast path with facet (paginate first, then minimal lookup)
		pipeline = append(pipeline,
			bson.D{{Key: "$facet", Value: bson.M{
				"metadata": []bson.M{
					{"$count": "total"},
				},
				"data": []bson.M{
					{"$skip": int64((page - 1) * limit)},
					{"$limit": int64(limit)},
					{"$lookup": bson.M{
						"from":         "digital_licenses",
						"localField":   "_id",
						"foreignField": "bookId",
						"pipeline":     []bson.M{{"$limit": 1}},
						"as":           "license",
					}},
					{"$addFields": bson.M{
						"hasDigital":  bson.M{"$gt": []interface{}{bson.M{"$size": "$license"}, 0}},
						"accessModel": bson.M{"$arrayElemAt": []interface{}{"$license.accessModel", 0}},
					}},
					{"$project": bson.M{"license": 0}},
				},
			}}},
		)
	} else {
		// FAST PATH: Paginate first, then lookup (for performance)
		pipeline = append(pipeline,
			bson.D{{Key: "$facet", Value: bson.M{
				"metadata": []bson.M{
					{"$count": "total"},
				},
				"data": []bson.M{
					{"$skip": int64((page - 1) * limit)},
					{"$limit": int64(limit)},
					// Lookup digital licenses ONLY for paginated subset
					{"$lookup": bson.M{
						"from":         "digital_licenses",
						"localField":   "_id",
						"foreignField": "bookId",
						"as":           "license",
					}},
					{"$addFields": bson.M{
						"hasDigital":  bson.M{"$gt": []interface{}{bson.M{"$size": "$license"}, 0}},
						"accessModel": bson.M{"$arrayElemAt": []interface{}{"$license.accessModel", 0}},
					}},
					{"$project": bson.M{"license": 0}},
				},
			}}},
		)
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching books"})
		return
	}
	defer cursor.Close(ctx)

	var result []struct {
		Metadata []struct {
			Total int `bson:"total"`
		} `bson:"metadata"`
		Data []BookWithLicense `bson:"data"`
	}

	if err = cursor.All(ctx, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error decoding books"})
		return
	}

	books := []BookWithLicense{}
	total := 0

	if len(result) > 0 {
		if len(result[0].Data) > 0 {
			books = result[0].Data
		}
		if len(result[0].Metadata) > 0 {
			total = result[0].Metadata[0].Total
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": books,
		"meta": gin.H{
			"total":      total,
			"userPage":   page,
			"limit":      limit,
			"totalPages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func GetBook(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// 1. Get Book Info
	var book models.Book
	err = config.GetCollection("books").FindOne(ctx, bson.M{"_id": objID}).Decode(&book)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Book not found"})
		return
	}

	// 2. Count Physical Copies
	copyColl := config.GetCollection("physical_copies")
	totalCopies, _ := copyColl.CountDocuments(ctx, bson.M{"bookId": objID})
	availCopies, _ := copyColl.CountDocuments(ctx, bson.M{"bookId": objID, "status": "AVAILABLE"})

	// 3. Check Digital License
	licColl := config.GetCollection("digital_licenses")
	hasEbookCount, _ := licColl.CountDocuments(ctx, bson.M{"bookId": objID})

	// 4. Branch Inventory Aggregation
	branchPipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"bookId": objID}}},
		{{Key: "$group", Value: bson.M{
			"_id": "$branchId",
			"total": bson.M{"$sum": 1},
			"available": bson.M{"$sum": bson.M{
				"$cond": []interface{}{
					bson.M{"$eq": []string{"$status", "AVAILABLE"}},
					1,
					0,
				},
			}},
		}}},
	}
	
	cursor, _ := copyColl.Aggregate(ctx, branchPipeline)
	var branchStats []struct {
		BranchID  string `bson:"_id" json:"branchId"`
		Available int    `bson:"available" json:"available"`
		Total     int    `bson:"total" json:"total"`
	}
	cursor.All(ctx, &branchStats)

	// 5. Digital License Details
	var digitalLicense struct {
		AccessModel     string `json:"accessModel"`
		ConcurrentLimit int    `json:"concurrentLimit"`
		ActiveLoans     int    `json:"activeLoans"`
	}
	
	// Fetch License
	var licenseDoc struct {
		AccessModel     string `bson:"accessModel"`
		ConcurrentLimit int    `bson:"concurrentLimit"`
	}
	err = licColl.FindOne(ctx, bson.M{"bookId": objID}).Decode(&licenseDoc)
	
	if err == nil {
		digitalLicense.AccessModel = licenseDoc.AccessModel
		digitalLicense.ConcurrentLimit = licenseDoc.ConcurrentLimit
		
		// If OCOU, Count Active Loans
		if licenseDoc.AccessModel == "OCOU" {
			loanColl := config.GetCollection("loans")
			activeCount, _ := loanColl.CountDocuments(ctx, bson.M{
				"bookId": objID,
				"itemType": "DIGITAL",
				"status": bson.M{"$in": []string{"BORROWED", "ACTIVE"}},
			})
			digitalLicense.ActiveLoans = int(activeCount)
		}
	} else {
		// No License
		digitalLicense.AccessModel = "NONE"
	}

	detail := models.BookDetail{
		Book:            book,
		TotalCopies:     int(totalCopies),
		AvailableCopies: int(availCopies),
		HasEbook:        hasEbookCount > 0,
		BranchInventory: []struct {
			BranchID  string `json:"branchId"`
			Available int    `json:"available"`
			Total     int    `json:"total"`
		}(branchStats),
		DigitalLicense: digitalLicense,
	}

	c.JSON(http.StatusOK, detail)
}
