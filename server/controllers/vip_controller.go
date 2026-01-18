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


type VIPPackage struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Duration int    `json:"duration"` // days
	Price    int    `json:"price"`    // VND
	Discount int    `json:"discount"` // percentage
}

var vipPackages = []VIPPackage{
	{ID: "1month", Name: "1 Month VIP", Duration: 30, Price: 50000, Discount: 0},
	{ID: "3months", Name: "3 Months VIP", Duration: 90, Price: 120000, Discount: 20},
	{ID: "6months", Name: "6 Months VIP", Duration: 180, Price: 200000, Discount: 33},
	{ID: "1year", Name: "1 Year VIP", Duration: 365, Price: 300000, Discount: 50},
}

func GetVIPPackages(c *gin.Context) {
	// Try to fetch from System Config first
	var configDoc models.SystemConfig
	err := config.GetCollection("system_config").FindOne(context.TODO(), bson.M{"key": "VIP_PACKAGES"}).Decode(&configDoc)
	
	if err == nil {
		// Parse Value
		if pkgBytes, err := bson.Marshal(configDoc.Value); err == nil {
			var pkgVal models.VIPPackagesValue
			if err := bson.Unmarshal(pkgBytes, &pkgVal); err == nil && len(pkgVal.Packages) > 0 {
				c.JSON(http.StatusOK, gin.H{"packages": pkgVal.Packages})
				return
			}
		}
	}

	// Fallback to hardcoded
	c.JSON(http.StatusOK, gin.H{
		"packages": vipPackages,
	})
}

func GetVIPStatus(c *gin.Context) {
	memberID, _ := c.Get("memberID")
	objID, _ := primitive.ObjectIDFromHex(memberID.(string))

	var member models.Member
	err := config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	response := gin.H{
		"isVip":   member.IsVIP,
		"vipType": member.VIPType,
	}

	if member.VIPExpiresAt != nil {
		response["vipExpiresAt"] = member.VIPExpiresAt
		response["daysRemaining"] = int(time.Until(*member.VIPExpiresAt).Hours() / 24)
	} else if member.IsVIP {
		response["permanent"] = true
	}

	c.JSON(http.StatusOK, response)
}

type PurchaseVIPRequest struct {
	PackageID string `json:"packageId" binding:"required"`
}

func PurchaseVIP(c *gin.Context) {
	memberID, _ := c.Get("memberID")
	objID, _ := primitive.ObjectIDFromHex(memberID.(string))

	var req PurchaseVIPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Determine source of packages
	var availablePackages []VIPPackage

	// Try DB
	var configDoc models.SystemConfig
	err := config.GetCollection("system_config").FindOne(context.TODO(), bson.M{"key": "VIP_PACKAGES"}).Decode(&configDoc)
	if err == nil {
		if pkgBytes, err := bson.Marshal(configDoc.Value); err == nil {
			var pkgVal models.VIPPackagesValue
			if err := bson.Unmarshal(pkgBytes, &pkgVal); err == nil && len(pkgVal.Packages) > 0 {
				// Convert models.VIPPackageConfig to local VIPPackage
				for _, p := range pkgVal.Packages {
					availablePackages = append(availablePackages, VIPPackage{
						ID:       p.ID,
						Name:     p.Name,
						Duration: p.Duration,
						Price:    p.Price,
						Discount: p.Discount,
					})
				}
			}
		}
	}

	// Fallback
	if len(availablePackages) == 0 {
		availablePackages = vipPackages
	}

	// Find package
	var selectedPackage *VIPPackage
	for _, pkg := range availablePackages {
		if pkg.ID == req.PackageID {
			selectedPackage = &pkg
			break
		}
	}

	if selectedPackage == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid package ID"})
		return
	}

	// Get member
	var member models.Member
	err = config.GetCollection("members").FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&member)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Check wallet balance
	if member.WalletBalance < selectedPackage.Price {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient wallet balance"})
		return
	}

	// Calculate expiration
	var expiresAt time.Time
	if member.IsVIP && member.VIPExpiresAt != nil && member.VIPExpiresAt.After(time.Now()) {
		// Extend existing VIP
		expiresAt = member.VIPExpiresAt.Add(time.Duration(selectedPackage.Duration) * 24 * time.Hour)
	} else {
		// New VIP
		expiresAt = time.Now().Add(time.Duration(selectedPackage.Duration) * 24 * time.Hour)
	}

	// Update member
	update := bson.M{
		"$set": bson.M{
			"isVip":               true,
			"vipExpiresAt":        expiresAt,
			"vipType":             "PURCHASED",
			"walletBalance":       member.WalletBalance - selectedPackage.Price,
			"subscription.plan":   "VIP",
			"subscription.active": true,
		},
	}

	_, err = config.GetCollection("members").UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to purchase VIP"})
		return
	}
	// Create transaction record
	transaction := models.Transaction{
		MemberID:    objID,
		Amount:      -selectedPackage.Price, // Negative for deduction
		Type:        "VIP_PURCHASE",
		Description: "VIP Purchase: " + selectedPackage.Name,
		CreatedAt:   time.Now(),
	}
	config.GetCollection("transactions").InsertOne(context.TODO(), transaction)


	c.JSON(http.StatusOK, gin.H{
		"message":      "VIP purchased successfully",
		"vipExpiresAt": expiresAt,
		"newBalance":   member.WalletBalance - selectedPackage.Price,
	})
}
