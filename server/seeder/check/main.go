package main

import (
    "context"
    "fmt"
    "elibrary-api/config"
    "elibrary-api/models"
    "go.mongodb.org/mongo-driver/bson"
    // "go.mongodb.org/mongo-driver/bson/primitive"
)

func main() {
    config.ConnectDB()
    invColl := config.GetCollection("inventory")
    pcColl := config.GetCollection("physical_copies")
    booksColl := config.GetCollection("books")
    
    cursor, _ := invColl.Find(context.TODO(), bson.M{})
    var invs []models.Inventory
    cursor.All(context.TODO(), &invs)
    
    mismatchCount := 0
    
    for _, inv := range invs {
        // Check Total
        totalPC, _ := pcColl.CountDocuments(context.TODO(), bson.M{"bookId": inv.BookID, "branchId": inv.BranchID})
        
        // Check Available
        availPC, _ := pcColl.CountDocuments(context.TODO(), bson.M{"bookId": inv.BookID, "branchId": inv.BranchID, "status": "AVAILABLE"})
        
        if int(totalPC) != inv.TotalCopies || int(availPC) != inv.AvailableCopies {
             var book models.Book
             booksColl.FindOne(context.TODO(), bson.M{"_id": inv.BookID}).Decode(&book)
            
            fmt.Printf("MISMATCH for %s (%s):\n", book.Title, inv.BranchID)
            fmt.Printf("  Inventory: Total=%d, Avail=%d\n", inv.TotalCopies, inv.AvailableCopies)
            fmt.Printf("  Physical : Total=%d, Avail=%d\n", totalPC, availPC)
            mismatchCount++
        }
    }
    
    if mismatchCount == 0 {
        fmt.Println("All synchronized!")
    } else {
        fmt.Printf("Found %d discrepancies.\n", mismatchCount)
    }
}
