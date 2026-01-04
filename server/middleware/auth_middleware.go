package middleware

import (
	"context"
	"elibrary-api/config"
	"elibrary-api/models"
	"elibrary-api/utils"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header missing"})
			c.Abort()
			return
		}

		// Bearer <token>
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Fetch User from DB to get fresh status/branch
		collection := config.GetCollection("members")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var member models.Member
		objID, _ := primitive.ObjectIDFromHex(claims.UserID)
		err = collection.FindOne(ctx, bson.M{"_id": objID}).Decode(&member)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

	// Check VIP expiration
	if member.IsVIP && member.VIPExpiresAt != nil && member.VIPExpiresAt.Before(time.Now()) {
		// VIP has expired, update member
		update := bson.M{
			"$set": bson.M{"isVip": false},
			"$unset": bson.M{"vipExpiresAt": "", "vipType": ""},
		}
		collection.UpdateOne(ctx, bson.M{"_id": objID}, update)
		member.IsVIP = false
		member.VIPExpiresAt = nil
		member.VIPType = ""
	}


		// Store user in context
		c.Set("user", &member)
	c.Set("memberID", member.ID.Hex())
		c.Next()
	}
}

// RequireAdmin middleware - only Admin can access
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userVal, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		user := userVal.(*models.Member)
		if user.Role != "ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireStaffOrAdmin middleware - Staff or Admin can access
func RequireStaffOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userVal, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		user := userVal.(*models.Member)
		if user.Role != "ADMIN" && user.Role != "STAFF" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Staff or Admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
