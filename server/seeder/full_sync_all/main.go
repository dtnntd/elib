package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"elibrary-api/config"
	"elibrary-api/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	// "go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	config.ConnectDB()
	fmt.Println("Connected. Starting Optimized Sync...")

	booksColl := config.GetCollection("books")
	invColl := config.GetCollection("inventory")
	pcColl := config.GetCollection("physical_copies")
	branches := []string{"HN", "HP", "DN"}

	// 1. Snapshot existing Inventory to memory map (BookID+BranchID -> bool)
	fmt.Println("Loading existing inventory map...")
	existsMap := make(map[string]bool)
	
	// Projection only needed fields
	opts := options.Find().SetProjection(bson.M{"bookId": 1, "branchId": 1})
	curInv, err := invColl.Find(context.TODO(), bson.M{}, opts)
	if err != nil {
		log.Fatal(err)
	}
	
	var existingInvs []models.Inventory
	if err = curInv.All(context.TODO(), &existingInvs); err != nil {
		log.Fatal(err)
	}
	
	for _, inv := range existingInvs {
		key := fmt.Sprintf("%s_%s", inv.BookID.Hex(), inv.BranchID)
		existsMap[key] = true
	}
	fmt.Printf("Loaded %d existing inventory records.\n", len(existsMap))

	// 2. Iterate Books and Bulk Insert
	curBooks, err := booksColl.Find(context.TODO(), bson.M{})
	if err != nil {
		log.Fatal(err)
	}
	defer curBooks.Close(context.TODO())

	var invBuffer []interface{}
	var pcBuffer []interface{}
	
	count := 0
	totalPC := 0
	
	flush := func() {
		if len(invBuffer) > 0 {
			_, err := invColl.InsertMany(context.TODO(), invBuffer)
			if err != nil {
				log.Printf("Bulk Insert Inventory Error: %v", err)
			}
			invBuffer = nil
		}
		if len(pcBuffer) > 0 {
			_, err := pcColl.InsertMany(context.TODO(), pcBuffer)
			if err != nil {
				log.Printf("Bulk Insert PC Error: %v", err)
			} else {
				totalPC += len(pcBuffer)
			}
			pcBuffer = nil
		}
	}

	for curBooks.Next(context.TODO()) {
		var book models.Book
		if err := curBooks.Decode(&book); err != nil {
			continue
		}

		for _, branch := range branches {
			key := fmt.Sprintf("%s_%s", book.ID.Hex(), branch)
			if existsMap[key] {
				continue
			}

			// Generate Data
			qty := 4 + rand.Intn(3) // 4-6
			
			newInv := models.Inventory{
				ID:              primitive.NewObjectID(),
				BookID:          book.ID,
				BranchID:        branch,
				TotalCopies:     qty,
				AvailableCopies: qty,
				UpdatedAt:       time.Now(),
			}
			invBuffer = append(invBuffer, newInv)

			for i := 0; i < qty; i++ {
				seq := i + 1
				isbn := book.ISBN
				if isbn == "" || isbn == "Unknown" {
					isbn = "BID" + book.ID.Hex()[len(book.ID.Hex())-4:]
				}
				barcode := fmt.Sprintf("%s-%s-%03d", isbn, branch, seq)
				
				pc := models.PhysicalCopy{
					ID:        primitive.NewObjectID(),
					BookID:    book.ID,
					BranchID:  branch,
					Barcode:   barcode,
					Status:    "AVAILABLE",
					Condition: "GOOD",
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				pcBuffer = append(pcBuffer, pc)
			}
		}

		count++
		if count%1000 == 0 {
			flush()
			fmt.Printf("Processed %d books... (New PCs: %d)\n", count, totalPC)
		}
	}
	
	flush() // Final flush
	fmt.Printf("DONE. Total Books Processed: %d. Total New Physical Copies: %d\n", count, totalPC)
}
