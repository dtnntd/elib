package main

import (
    "context"
    "fmt"
    "log"
    "elibrary-api/config"
    "go.mongodb.org/mongo-driver/bson"
)

func main() {
    config.ConnectDB()
    db := config.Client.Database("elibrary")
    
    // 1. List Collections
    colls, err := db.ListCollectionNames(context.TODO(), bson.M{})
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println("Existing Collections:", colls)
    
    // 2. Check digital_licenses if exists
    found := false
    for _, name := range colls {
        if name == "digital_licenses" {
            found = true
            break
        }
    }
    
    if found {
        fmt.Println("\nInspecting 'digital_licenses':")
        var doc bson.M
        err := db.Collection("digital_licenses").FindOne(context.TODO(), bson.M{}).Decode(&doc)
        if err != nil {
            fmt.Println("Error reading document:", err)
        } else {
            fmt.Println("Sample Document:", doc)
        }
        
        // Check Distinct Types
        types, _ := db.Collection("digital_licenses").Distinct(context.TODO(), "accessModel", bson.M{})
        fmt.Println("Distinct Access Models:", types)
    } else {
        fmt.Println("\nCollection 'digital_licenses' NOT FOUND.")
    }
}
