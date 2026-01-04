package controllers

import (
	"context"
	"net/http"
	"time"

	"elibrary-api/models"
	"elibrary-api/config"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GrantVIPRequest struct {
	Duration int `json:"duration"` // days, 0 = permanent
}

// Admin/Staff can grant VIP to users
func GrantVIP(c *gin.Context) {
	// Get admin/staff info
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	// Only Admin and Staff can grant VIP
	if user.Role != "ADMIN" && user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Admin or Staff can grant VIP"})
		return
	}

	targetMemberID := c.Param("memberId")
	objID, err := primitive.ObjectIDFromHex(targetMemberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	var req GrantVIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get target member
	var member models.Member
	err = config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"isVip":   true,
			"vipType": "STAFF", // Granted by staff/admin
		},
	}

	// Set expiration
	if req.Duration > 0 {
		expiresAt := time.Now().Add(time.Duration(req.Duration) * 24 * time.Hour)
		update["$set"].(bson.M)["vipExpiresAt"] = expiresAt
	} else {
		// Permanent VIP
		update["$unset"] = bson.M{"vipExpiresAt": ""}
	}

	_, err = config.GetCollection("members").UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to grant VIP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "VIP granted successfully",
	})
}

type PromoteRoleRequest struct {
	Role string `json:"role" binding:"required"` // "STAFF" or "ADMIN"
}

// Only Admin can promote users to Staff or Admin
func PromoteRole(c *gin.Context) {
	// Get admin info
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	// Only Admin can promote roles
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Admin can promote user roles"})
		return
	}

	targetMemberID := c.Param("memberId")
	objID, err := primitive.ObjectIDFromHex(targetMemberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	var req PromoteRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	if req.Role != "STAFF" && req.Role != "ADMIN" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be STAFF or ADMIN"})
		return
	}

	// Get target member
	var member models.Member
	err = config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Update role and grant permanent VIP
	update := bson.M{
		"$set": bson.M{
			"role":    req.Role,
			"isVip":   true,
			"vipType": req.Role, // "STAFF" or "ADMIN"
		},
		"$unset": bson.M{
			"vipExpiresAt": "", // Permanent VIP for staff/admin
		},
	}

	_, err = config.GetCollection("members").UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to promote user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User promoted successfully to " + req.Role,
	})
}

// Get all members (Admin/Staff only)
func GetAllMembers(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	if user.Role != "ADMIN" && user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Admin or Staff can view all members"})
		return
	}

	// Build filter based on role
	filter := bson.M{}
	if user.Role == "STAFF" {
		// Staff can only see members from their branch
		filter["branchId"] = user.BranchID
	}
	// Admin sees all members (no filter)

	cursor, err := config.GetCollection("members").Find(context.TODO(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}
	defer cursor.Close(context.TODO())

	var members []models.Member
	if err = cursor.All(context.TODO(), &members); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

// Revoke VIP (Admin/Staff only)
func RevokeVIP(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	if user.Role != "ADMIN" && user.Role != "STAFF" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Admin or Staff can revoke VIP"})
		return
	}

	targetMemberID := c.Param("memberId")
	objID, err := primitive.ObjectIDFromHex(targetMemberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	// Get target member
	var member models.Member
	err = config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Cannot revoke VIP from Admin/Staff
	if member.Role == "ADMIN" || member.Role == "STAFF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot revoke VIP from Admin or Staff"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"isVip": false,
		},
		"$unset": bson.M{
			"vipExpiresAt": "",
			"vipType":      "",
		},
	}

	_, err = config.GetCollection("members").UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke VIP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
"message": "VIP revoked successfully",
})
}

// Downgrade role (Admin only)
func DowngradeRole(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Admin can downgrade user roles"})
		return
	}

	targetMemberID := c.Param("memberId")
	objID, err := primitive.ObjectIDFromHex(targetMemberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	// Get target member
	var member models.Member
	err = config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Determine new role
	newRole := "MEMBER"
	if member.Role == "ADMIN" {
		newRole = "STAFF" // Admin -> Staff
	}

	update := bson.M{
		"$set": bson.M{
			"role":  newRole,
			"isVip": false,
		},
		"$unset": bson.M{
			"vipExpiresAt": "",
			"vipType":      "",
		},
	}

	_, err = config.GetCollection("members").UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to downgrade user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
"message": "User downgraded to " + newRole,
})
}
