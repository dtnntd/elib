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
	HasDigital  bool   `json:"hasDigital" bson:"hasDigital"`
	AccessModel string `json:"accessModel" bson:"accessModel"`
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
	
	// Basic Search Logic (Regex)
	if search != "" {
		matchStage["$or"] = []bson.M{
			{"title": bson.M{"$regex": search, "$options": "i"}},
			{"authors": bson.M{"$regex": search, "$options": "i"}},
		}
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
		bson.D{{Key: "$lookup", Value: bson.M{
			"from":         "digital_licenses",
			"localField":   "_id",
			"foreignField": "bookId",
			"as":           "license",
		}}},
		bson.D{{Key: "$addFields", Value: bson.M{
			"hasDigital": bson.M{"$gt": []interface{}{bson.M{"$size": "$license"}, 0}},
			"accessModel": bson.M{"$arrayElemAt": []interface{}{"$license.accessModel", 0}},
		}}},
		bson.D{{Key: "$project", Value: bson.M{"license": 0}}}, 
		bson.D{{Key: "$facet", Value: bson.M{
			"metadata": []bson.M{
				{"$count": "total"},
			},
			"data": []bson.M{
				{"$skip": int64((page - 1) * limit)},
				{"$limit": int64(limit)},
			},
		}}},
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
