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
)

func main() {
	// 1. Connect DB
	config.ConnectDB()
	fmt.Println("Connected to MongoDB for Seeding...")

	// 2. Sample Data
	sampleBooks := []models.Book{
		{Title: "To Kill a Mockingbird", Authors: []string{"Harper Lee"}, ISBN: "978-0061120084", Price: 150000, Subjects: []string{"Fiction", "Classic"}, Publisher: "Harper Perennial", PublishedYear: 1960, Lang: "en"},
		{Title: "1984", Authors: []string{"George Orwell"}, ISBN: "978-0451524935", Price: 120000, Subjects: []string{"Fiction", "Dystopian"}, Publisher: "Signet Classic", PublishedYear: 1949, Lang: "en"},
		{Title: "The Great Gatsby", Authors: []string{"F. Scott Fitzgerald"}, ISBN: "978-0743273565", Price: 135000, Subjects: []string{"Fiction", "Classic"}, Publisher: "Scribner", PublishedYear: 1925, Lang: "en"},
		{Title: "Dế Mèn Phiêu Lưu Ký", Authors: []string{"Tô Hoài"}, ISBN: "978-6042142278", Price: 50000, Subjects: []string{"Children", "Adventure", "Vietnamese"}, Publisher: "NXB Kim Đồng", PublishedYear: 1941, Lang: "vi"},
		{Title: "Số Đỏ", Authors: []string{"Vũ Trọng Phụng"}, ISBN: "978-6042071239", Price: 75000, Subjects: []string{"Satire", "Vietnamese"}, Publisher: "NXB Văn Học", PublishedYear: 1936, Lang: "vi"},
		{Title: "Mắt Biếc", Authors: []string{"Nguyễn Nhật Ánh"}, ISBN: "978-6042168926", Price: 90000, Subjects: []string{"Romance", "Youth", "Vietnamese"}, Publisher: "NXB Trẻ", PublishedYear: 1990, Lang: "vi"},
		{Title: "Clean Code", Authors: []string{"Robert C. Martin"}, ISBN: "978-0132350884", Price: 800000, Subjects: []string{"Technology", "Programming"}, Publisher: "Prentice Hall", PublishedYear: 2008, Lang: "en"},
		{Title: "Introduction to Algorithms", Authors: []string{"Thomas H. Cormen", "Charles E. Leiserson"}, ISBN: "978-0262033848", Price: 1200000, Subjects: []string{"Technology", "Computer Science"}, Publisher: "MIT Press", PublishedYear: 2009, Lang: "en"},
		{Title: "Sapiens: A Brief History of Humankind", Authors: []string{"Yuval Noah Harari"}, ISBN: "978-0062316097", Price: 250000, Subjects: []string{"History", "Anthropology"}, Publisher: "Harper", PublishedYear: 2011, Lang: "en"},
		{Title: "Đắc Nhân Tâm", Authors: []string{"Dale Carnegie"}, ISBN: "978-6045860346", Price: 86000, Subjects: []string{"Self-help"}, Publisher: "First News", PublishedYear: 1936, Lang: "vi"},
		{Title: "Harry Potter and the Sorcerer's Stone", Authors: []string{"J.K. Rowling"}, ISBN: "978-0590353427", Price: 200000, Subjects: []string{"Fantasy", "Young Adult"}, Publisher: "Scholastic", PublishedYear: 1997, Lang: "en"},
		{Title: "Nhà Giả Kim", Authors: []string{"Paulo Coelho"}, ISBN: "978-6042079631", Price: 69000, Subjects: []string{"Fiction", "Philosophy"}, Publisher: "NXB Văn Học", PublishedYear: 1988, Lang: "vi"},
        {Title: "Designing Data-Intensive Applications", Authors: []string{"Martin Kleppmann"}, ISBN: "978-1449373320", Price: 950000, Subjects: []string{"Technology", "Database"}, Publisher: "O'Reilly Media", PublishedYear: 2017, Lang: "en"},
        {Title: "Lão Hạc", Authors: []string{"Nam Cao"}, ISBN: "978-6042152345", Price: 45000, Subjects: []string{"Fiction", "Realism", "Vietnamese"}, Publisher: "NXB Văn Học", PublishedYear: 1943, Lang: "vi"},
        {Title: "Tắt Đèn", Authors: []string{"Ngô Tất Tố"}, ISBN: "978-6042152352", Price: 48000, Subjects: []string{"Fiction", "Realism", "Vietnamese"}, Publisher: "NXB Văn Học", PublishedYear: 1937, Lang: "vi"},
	}

	booksColl := config.GetCollection("books")
	invColl := config.GetCollection("inventory")
	branches := []string{"HN", "HP", "DN"}

	for _, book := range sampleBooks {
		// Check if ISBN exists
		var existingBook models.Book
		err := booksColl.FindOne(context.TODO(), bson.M{"isbn": book.ISBN}).Decode(&existingBook)

		var bookID primitive.ObjectID

		if err == nil {
			fmt.Printf("Book already exists: %s\n", book.Title)
			bookID = existingBook.ID
		} else {
			// Insert Book
			book.ID = primitive.NewObjectID()
			_, err := booksColl.InsertOne(context.TODO(), book)
			if err != nil {
				log.Printf("Failed to insert book %s: %v", book.Title, err)
				continue
			}
			fmt.Printf("Inserted book: %s\n", book.Title)
			bookID = book.ID
		}

		// Seed Inventory
		for _, branch := range branches {
			// Check inventory exists
			count, _ := invColl.CountDocuments(context.TODO(), bson.M{"bookId": bookID, "branchId": branch})
			if count > 0 {
				continue // Skip if already has inventory
			}

			// Random quantity
			
			qty := rand.Intn(50) // 0 to 49
			if rand.Float32() < 0.2 {
				qty = 0 // 20% chance of out of stock
			}

			// Must not insert if we are just re-seeding books but inventory is missing? No, we add missing inventory.

			inv := models.Inventory{
				ID:              primitive.NewObjectID(),
				BookID:          bookID,
				BranchID:        branch,
				TotalCopies:     qty,
				AvailableCopies: qty,
				UpdatedAt:       time.Now(),
			}
			_, err := invColl.InsertOne(context.TODO(), inv)
			if err != nil {
				log.Printf("Failed to insert inventory for %s at %s: %v", book.Title, branch, err)
			} else {
				fmt.Printf("Initialized inventory for %s at %s: %d copies\n", book.Title, branch, qty)
			}
		}
	}
	fmt.Println("Seeding completed successfully!")
}
