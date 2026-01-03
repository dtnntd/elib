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
	"go.mongodb.org/mongo-driver/mongo/options"
)

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

	filter := bson.M{}
	
	// Basic Search Logic (Regex)
	if search != "" {
		filter["$or"] = []bson.M{
			{"title": bson.M{"$regex": search, "$options": "i"}},
			{"authors": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	if subject != "" {
		filter["subjects"] = subject
	}
	if author != "" {
		// If using regex for partial match
		filter["authors"] = bson.M{"$regex": author, "$options": "i"}
	}
	if language != "" {
		filter["lang"] = language
	}
	if yearStr != "" {
		year, err := strconv.Atoi(yearStr)
		if err == nil {
			filter["publishedYear"] = year
		}
	}

	opts := options.Find().SetSkip(int64((page - 1) * limit)).SetLimit(int64(limit))

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching books"})
		return
	}
	defer cursor.Close(ctx)

	books := []models.Book{}
	if err = cursor.All(ctx, &books); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error decoding books"})
		return
	}

	total, _ := collection.CountDocuments(ctx, filter)

	c.JSON(http.StatusOK, gin.H{
		"data": books,
		"meta": gin.H{
			"total":       total,
			"userPage":    page,
			"limit":       limit,
			"totalPages":  int(math.Ceil(float64(total) / float64(limit))),
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

	detail := models.BookDetail{
		Book:            book,
		TotalCopies:     int(totalCopies),
		AvailableCopies: int(availCopies),
		HasEbook:        hasEbookCount > 0,
	}

	c.JSON(http.StatusOK, detail)
}
