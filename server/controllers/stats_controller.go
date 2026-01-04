package controllers

import (
	"context"
	"net/http"
	"time"

	"elibrary-api/config"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// Metric Response Struct
type DashboardStats struct {
	TotalBooks     int64   `json:"totalBooks"`
	TotalMembers   int64   `json:"totalMembers"`
	ActiveLoans    int64   `json:"activeLoans"`
	TotalRevenue   int     `json:"totalRevenue"`
	MonthlyRevenue []int64 `json:"monthlyRevenue"` // Simplified placeholder
}

func GetDashboardStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	branchId := c.Query("branchId")

	// 1. Total Books (Global Catalog - Unfiltered)
	totalBooks, _ := config.GetCollection("books").CountDocuments(ctx, bson.M{})

	// 2. Total Members
	memberFilter := bson.M{}
	if branchId != "" {
		memberFilter["branchId"] = branchId
	}
	totalMembers, _ := config.GetCollection("members").CountDocuments(ctx, memberFilter)

	// 3. Active Loans: BORROWED or RESERVED or OVERDUE
	loanFilter := bson.M{
		"status": bson.M{"$in": []string{"BORROWED", "RESERVED", "OVERDUE"}},
	}
	if branchId != "" {
		loanFilter["branchId"] = branchId
	}
	activeLoans, _ := config.GetCollection("loans").CountDocuments(ctx, loanFilter)

	// 4. Revenue (Aggregation)
	// If branchId is present, we must join with Members to filter by branch
	pipeline := mongo.Pipeline{}

	if branchId != "" {
		// Join with Members to check branch
		pipeline = append(pipeline,
			bson.D{{Key: "$lookup", Value: bson.M{
				"from":         "members",
				"localField":   "memberId",
				"foreignField": "_id",
				"as":           "member_info",
			}}},
			bson.D{{Key: "$unwind", Value: "$member_info"}},
			bson.D{{Key: "$match", Value: bson.M{"member_info.branchId": branchId}}},
		)
	}

	// Filter DEPOSITs only
	pipeline = append(pipeline,
		bson.D{{Key: "$match", Value: bson.M{"type": "DEPOSIT"}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":   nil,
			"total": bson.M{"$sum": "$amount"},
		}}},
	)

	cursor, err := config.GetCollection("transactions").Aggregate(ctx, pipeline)
	totalRevenue := 0
	if err == nil && cursor.Next(ctx) {
		var result struct {
			Total int `bson:"total"`
		}
		if err := cursor.Decode(&result); err == nil {
			totalRevenue = result.Total
		}
	}

	c.JSON(http.StatusOK, DashboardStats{
		TotalBooks:   totalBooks,
		TotalMembers: totalMembers,
		ActiveLoans:  activeLoans,
		TotalRevenue: totalRevenue,
	})
}

// GetMonthlyTrends returns loans per month for the last 6 months
func GetMonthlyTrends(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	branchId := c.Query("branchId")
	loansColl := config.GetCollection("loans")

	// Filter: Last 6 months
	sixMonthsAgo := time.Now().AddDate(0, -6, 0)

	matchStage := bson.M{"borrowedAt": bson.M{"$gte": sixMonthsAgo}}
	if branchId != "" {
		matchStage["branchId"] = branchId
	}

	// 2. Aggregate
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: matchStage}},
		{{Key: "$group", Value: bson.M{
			"_id": bson.M{
				"month": bson.M{"$month": "$borrowedAt"},
				"year":  bson.M{"$year": "$borrowedAt"},
			},
			"count": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"_id.year": 1, "_id.month": 1}}},
	}

	cursor, err := loansColl.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	type TrendResult struct {
		ID struct {
			Month int `bson:"month" json:"month"`
			Year  int `bson:"year" json:"year"`
		} `bson:"_id" json:"_id"`
		Count int `bson:"count" json:"count"`
	}

	results := make([]TrendResult, 0)

	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}
// GetBranchMemberStats returns members with their loan counts
func GetBranchMemberStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	branchId := c.Query("branchId")
	matchStage := bson.M{}
	if branchId != "" {
		matchStage["branchId"] = branchId
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: matchStage}},
		// Lookup Active Loans
		{{Key: "$lookup", Value: bson.M{
			"from": "loans",
			"let":  bson.M{"mid": "$_id"},
			"pipeline": []bson.M{
				{"$match": bson.M{
					"$expr": bson.M{"$eq": []string{"$memberId", "$$mid"}},
					"status": bson.M{"$in": []string{"BORROWED", "OVERDUE", "RESERVED"}},
				}},
			},
			"as": "active_loans",
		}}},
		// Lookup History Count
		{{Key: "$lookup", Value: bson.M{
			"from": "loans",
			"let":  bson.M{"mid": "$_id"},
			"pipeline": []bson.M{
				{"$match": bson.M{
					"$expr": bson.M{"$eq": []string{"$memberId", "$$mid"}},
					"status": "RETURNED",
				}},
				{"$count": "count"},
			},
			"as": "history_count",
		}}},
		// Project
		{{Key: "$project", Value: bson.M{
			"id":             "$_id",
			"fullName":       1,
			"email":          1,
			"memberCode":     1,
			"activeLoans":    bson.M{"$size": "$active_loans"},
			"totalReturn":    bson.M{"$ifNull": []interface{}{bson.M{"$arrayElemAt": []interface{}{"$history_count.count", 0}}, 0}},
			"joinedAt":       "$createdAt",
		}}},
		{{Key: "$sort", Value: bson.M{"activeLoans": -1}}}, // Most active first
	}

	cursor, err := config.GetCollection("members").Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

// GetBranchCirculationStats returns detailed list of active loans
func GetBranchCirculationStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	branchId := c.Query("branchId")
	matchStage := bson.M{
		"status": bson.M{"$in": []string{"BORROWED", "OVERDUE", "RESERVED"}},
	}
	if branchId != "" {
		matchStage["branchId"] = branchId
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: matchStage}},
		// Join Book for Title
		{{Key: "$lookup", Value: bson.M{
			"from":         "books",
			"localField":   "bookId",
			"foreignField": "_id",
			"as":           "book",
		}}},
		{{Key: "$unwind", Value: bson.M{"path": "$book", "preserveNullAndEmptyArrays": true}}},
		// Join Member for Name
		{{Key: "$lookup", Value: bson.M{
			"from":         "members",
			"localField":   "memberId",
			"foreignField": "_id",
			"as":           "member",
		}}},
		{{Key: "$unwind", Value: bson.M{"path": "$member", "preserveNullAndEmptyArrays": true}}},
		// Project
		{{Key: "$project", Value: bson.M{
			"id":           "$_id",
			"bookTitle":    bson.M{"$ifNull": []interface{}{"$book.title", "Unknown / Deleted Book"}},
			"bookId":       "$book._id",
			"copyId":       1,
			"memberName":   bson.M{"$ifNull": []interface{}{"$member.fullName", "Unknown User"}},
			"memberEmail":  "$member.email",
			"borrowedAt":   1,
			"dueDate":      1,
			"status":       1,
		}}},
		{{Key: "$sort", Value: bson.M{"dueDate": 1}}}, // Due soonest first
	}

	cursor, err := config.GetCollection("loans").Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}
