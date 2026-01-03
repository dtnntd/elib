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

	// 1. Counts
	totalBooks, _ := config.GetCollection("books").CountDocuments(ctx, bson.M{})
	totalMembers, _ := config.GetCollection("members").CountDocuments(ctx, bson.M{})
	
	// Active Loans: BORROWED or RESERVED or OVERDUE
	activeLoans, _ := config.GetCollection("loans").CountDocuments(ctx, bson.M{
		"status": bson.M{"$in": []string{"BORROWED", "RESERVED", "OVERDUE"}},
	})

	// 2. Revenue (Aggregation)
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"type": "DEPOSIT"}}},
		{{Key: "$group", Value: bson.M{
			"_id":   nil,
			"total": bson.M{"$sum": "$amount"},
		}}},
	}
	
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

	loansColl := config.GetCollection("loans")

	// Filter: Last 6 months
	sixMonthsAgo := time.Now().AddDate(0, -6, 0)
	// 2. Aggregate
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"borrowedAt": bson.M{"$gte": sixMonthsAgo}}}},
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
