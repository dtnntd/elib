package controllers

import (
	"context"
	"net/http"
	"time"

	"elibrary-api/config"
	"elibrary-api/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// TopUp handles adding funds to wallet
func TopUp(c *gin.Context) {
	// 1. Get User
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	// 2. Parse Input
	var req struct {
		Amount int `json:"amount" binding:"required,min=1000"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid amount (min 1000)"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	memberColl := config.GetCollection("members")
	transColl := config.GetCollection("transactions")

	// 3. Update Wallet Balance
	update := bson.M{"$inc": bson.M{"walletBalance": req.Amount}}
	_, err := memberColl.UpdateOne(ctx, bson.M{"_id": user.ID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update wallet"})
		return
	}

	// 4. Create Transaction Record
	transaction := models.Transaction{
		MemberID:    user.ID,
		Amount:      req.Amount,
		Type:        "DEPOSIT",
		Description: "Wallet Top Up",
		CreatedAt:   time.Now(),
	}
	transColl.InsertOne(ctx, transaction)

	// 5. Return Success
	c.JSON(http.StatusOK, gin.H{
		"message":       "Top up successful",
		"newBalance":    user.WalletBalance + req.Amount, // Optimistic
		"transactionId": transaction.ID,
	})
}

// GetWalletHistory returns transaction history
func GetWalletHistory(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	transColl := config.GetCollection("transactions")

	// Find transactions for this user
	filter := bson.M{"memberId": user.ID}
	opts := options.Find().SetSort(bson.M{"createdAt": -1}) // Newest first

	cursor, err := transColl.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}
	defer cursor.Close(ctx)
	
	// Initialize as empty slice to ensure JSON returns [] instead of null
	transactions := []models.Transaction{}
	if err = cursor.All(ctx, &transactions); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Decoding error"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// GetWalletBalance returns current balance
func GetWalletBalance(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	memberColl := config.GetCollection("members")

	var member models.Member
	err := memberColl.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"balance": member.WalletBalance})
}
