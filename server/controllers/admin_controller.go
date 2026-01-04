package controllers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"elibrary-api/models"
	"elibrary-api/config"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
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

type AssignBranchRequest struct {
	BranchID string `json:"branchId" binding:"required"`
}

// Assign Branch to Staff (Admin only)
func AssignBranch(c *gin.Context) {
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Admin can assign branches"})
		return
	}

	targetMemberID := c.Param("memberId")
	objID, err := primitive.ObjectIDFromHex(targetMemberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	var req AssignBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate Branch ID (Simple check)
	validBranches := map[string]bool{"HN": true, "HP": true, "DN": true}
	if !validBranches[req.BranchID] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid branch ID (HN, HP, DN)"})
		return
	}

	// Get target member
	var member models.Member
	err = config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	if member.Role != "STAFF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only assign branch to Staff members"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"branchId": req.BranchID,
		},
	}

	_, err = config.GetCollection("members").UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign branch"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Branch assigned successfully",
	})
}

// ============= POLICY MANAGEMENT =============

// Get System Loan Policy
func GetPolicy(c *gin.Context) {
	// 1. Check Admin
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	coll := config.GetCollection("system_config")
	key := "LOAN_POLICY"

	var configDoc models.SystemConfig
	err := coll.FindOne(context.TODO(), bson.M{"key": key}).Decode(&configDoc)

	if err == mongo.ErrNoDocuments {
		// Initialize Default Policy
		defaultPolicy := models.PolicyValue{
			Basic: models.RolePolicy{
				MaxPhysical:         2,
				MaxDigitalUnlimited: 5,
				MaxDigitalOCOU:      1,
			},
			VIP: models.RolePolicy{
				MaxPhysical:         10,
				MaxDigitalUnlimited: -1, // Unlimited
				MaxDigitalOCOU:      10,
			},
		}
		
		newConfig := models.SystemConfig{
			ID:    primitive.NewObjectID(),
			Key:   key,
			Value: defaultPolicy,
		}
		
		coll.InsertOne(context.TODO(), newConfig)
		c.JSON(http.StatusOK, newConfig)
		return
	}

	// Fix: Ensure Value is decoded as Struct/Map for JSON friendliness (avoid bson.D array issue)
	if valBytes, err := bson.Marshal(configDoc.Value); err == nil {
		var policyVal models.PolicyValue
		if err := bson.Unmarshal(valBytes, &policyVal); err == nil {
			configDoc.Value = policyVal
		}
	}

	c.JSON(http.StatusOK, configDoc)
}

// Update System Loan Policy
func UpdatePolicy(c *gin.Context) {
	// 1. Check Admin
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var req models.PolicyValue
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("[DEBUG] UpdatePolicy Bind Error: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	fmt.Printf("[DEBUG] UpdatePolicy Receiving: %+v\n", req)

	coll := config.GetCollection("system_config")
	key := "LOAN_POLICY"

	// Upsert
	opts := options.Update().SetUpsert(true)
	update := bson.M{
		"$set": bson.M{
			"value": req,
		},
	}

	_, err := coll.UpdateOne(context.TODO(), bson.M{"key": key}, update, opts)
	if err != nil {
		fmt.Printf("[DEBUG] UpdatePolicy DB Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update policy"})
		return
	}
	fmt.Printf("[DEBUG] Updated Policy in DB successfully\n")

	c.JSON(http.StatusOK, gin.H{"message": "Policy updated successfully"})
}
// ============= VIP CONFIG MANAGEMENT =============

// Get VIP Packages Config
func GetVIPConfig(c *gin.Context) {
	// 1. Check Admin
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	coll := config.GetCollection("system_config")
	key := "VIP_PACKAGES"

	var configDoc models.SystemConfig
	err := coll.FindOne(context.TODO(), bson.M{"key": key}).Decode(&configDoc)

	if err == mongo.ErrNoDocuments {
		// Initialize Default Packages
		defaultPackages := models.VIPPackagesValue{
			Packages: []models.VIPPackageConfig{
				{ID: "1month", Name: "1 Month VIP", Duration: 30, Price: 50000, Discount: 0},
				{ID: "3months", Name: "3 Months VIP", Duration: 90, Price: 120000, Discount: 20},
				{ID: "6months", Name: "6 Months VIP", Duration: 180, Price: 200000, Discount: 33},
				{ID: "1year", Name: "1 Year VIP", Duration: 365, Price: 300000, Discount: 50},
			},
		}
		
		newConfig := models.SystemConfig{
			ID:    primitive.NewObjectID(),
			Key:   key,
			Value: defaultPackages,
		}
		
		coll.InsertOne(context.TODO(), newConfig)
		// Return strictly the value structure to match frontend expectation
		c.JSON(http.StatusOK, newConfig)
		return
	}

	// Fix: Ensure Value is decoded as Struct/Map for JSON friendliness
	if valBytes, err := bson.Marshal(configDoc.Value); err == nil {
		var pkgVal models.VIPPackagesValue
		if err := bson.Unmarshal(valBytes, &pkgVal); err == nil {
			configDoc.Value = pkgVal
		}
	}

	c.JSON(http.StatusOK, configDoc)
}

// Update VIP Packages Config
func UpdateVIPConfig(c *gin.Context) {
	// 1. Check Admin
	userVal, _ := c.Get("user")
	user := userVal.(*models.Member)
	if user.Role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var req models.VIPPackagesValue
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	coll := config.GetCollection("system_config")
	key := "VIP_PACKAGES"

	// Upsert
	opts := options.Update().SetUpsert(true)
	update := bson.M{
		"$set": bson.M{
			"value": req,
		},
	}

	_, err := coll.UpdateOne(context.TODO(), bson.M{"key": key}, update, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update VIP config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "VIP configuration updated successfully"})
}
