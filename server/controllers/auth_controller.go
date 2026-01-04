package controllers

import (
	"context"
	"net/http"
	"time"

	"elibrary-api/config"
	"elibrary-api/models"
	"elibrary-api/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type LoginInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RegisterInput struct {
	FullName string `json:"fullName" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := config.GetCollection("members")
	var member models.Member

	// Find user
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := collection.FindOne(ctx, bson.M{"email": input.Email}).Decode(&member)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Email không tồn tại"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Login error"})
		return
	}

	// Check password
	if !utils.CheckPassword(input.Password, member.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Mật khẩu sai"})
		return
	}

	// Generate Token
	token, err := utils.GenerateToken(member.ID.Hex(), member.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  member,
	})
}

// Register for Demo purpose
func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := config.GetCollection("members")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check exists
	count, _ := collection.CountDocuments(ctx, bson.M{"email": input.Email})
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Email đã tồn tại"})
		return
	}

	hash, _ := utils.HashPassword(input.Password)
	newMember := models.Member{
		ID:           primitive.NewObjectID(),
		BranchID:     "HN", // Default for demo
		FullName:     input.FullName,
		Email:        input.Email,
		PasswordHash: hash,
		Role:         "MEMBER",
		WalletBalance: 0,
		Subscription: models.Subscription{
			Active:    true,
			Plan:      "BASIC",
			ExpiredAt: time.Now().AddDate(1, 0, 0),
		},
		CreatedAt: time.Now(),
	}

	_, err := collection.InsertOne(ctx, newMember)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Đăng ký thành công", "email": input.Email})
}

type UpdateProfileInput struct {
	FullName    string `json:"fullName"`
	BranchID    string `json:"branchId"`
	Password    string `json:"password"`
	OldPassword string `json:"oldPassword"`
}

func UpdateProfile(c *gin.Context) {
	// Get User from context (set by Middleware)
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	member := user.(*models.Member)

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updateFields := bson.M{}
	if input.FullName != "" {
		updateFields["fullName"] = input.FullName
	}
	if input.BranchID != "" {
		updateFields["branchId"] = input.BranchID
	}
	if input.Password != "" {
		if input.OldPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is required to set a new one"})
			return
		}
		// Verify old password
		if !utils.CheckPassword(input.OldPassword, member.PasswordHash) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect current password"})
			return
		}

		hash, _ := utils.HashPassword(input.Password)
		updateFields["passwordHash"] = hash
	}

	if len(updateFields) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	collection := config.GetCollection("members")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.UpdateOne(ctx, bson.M{"_id": member.ID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Return updated user
	var updatedMember models.Member
	collection.FindOne(ctx, bson.M{"_id": member.ID}).Decode(&updatedMember)

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated", "user": updatedMember})
}
