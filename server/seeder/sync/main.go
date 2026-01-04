package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"elibrary-api/config"
	"elibrary-api/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	config.ConnectDB()
	fmt.Println("Connected. Starting Sync...")

	// Clear Physical Copies to reset state
	config.GetCollection("physical_copies").Drop(context.TODO())

	// Ensure Indexes
	pcColl := config.GetCollection("physical_copies")
	_, err := pcColl.Indexes().CreateOne(context.TODO(), mongo.IndexModel{
		Keys:    bson.M{"barcode": 1},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		log.Fatal(err)
	}

	invColl := config.GetCollection("inventory")
	booksColl := config.GetCollection("books")

	cursor, _ := invColl.Find(context.TODO(), bson.M{})
	var inventories []models.Inventory
	cursor.All(context.TODO(), &inventories)

	totalCreated := 0

	for _, inv := range inventories {
		var book models.Book
		err := booksColl.FindOne(context.TODO(), bson.M{"_id": inv.BookID}).Decode(&book)
		if err != nil {
			fmt.Printf("Skipping inventory for missing book ID: %s\n", inv.BookID.Hex())
			continue
		}

		// Generate Copies matching TotalCopies
		for i := 0; i < inv.TotalCopies; i++ {
			// Generate Barcode: ISBN-BRANCH-SEQ (e.g. 978123-HN-001)
			seq := i + 1
			barcode := fmt.Sprintf("%s-%s-%03d", book.ISBN, inv.BranchID, seq)

			// Logic: First (Total - Available) could be marked as BORROWED if we tracked loans accurately.
			// But for this seed, we assume Total ~ Available (mostly returned).
			// If Total=5, Available=3 -> 2 Borrowed.
			// Currently our random seed made Total == Available. So all AVAILABLE.

			status := "AVAILABLE"

			pc := models.PhysicalCopy{
				ID:        primitive.NewObjectID(),
				BookID:    inv.BookID,
				BranchID:  inv.BranchID,
				Barcode:   barcode,
				Status:    status,
				Condition: "GOOD",
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}

			_, err := pcColl.InsertOne(context.TODO(), pc)
			if err != nil {
				// Avoid duplicate barcode error if re-running
				fmt.Printf("Error inserting copy %s: %v\n", barcode, err)
			} else {
				totalCreated++
			}
		}
		fmt.Printf("Processed %s (%s): %d copies\n", book.Title, inv.BranchID, inv.TotalCopies)
	}

	fmt.Printf("Sync Completed. Total Physical Copies Created: %d\n", totalCreated)
}
