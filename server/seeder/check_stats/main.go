package main

import (
    "context"
    "fmt"
    "elibrary-api/config"
    "go.mongodb.org/mongo-driver/bson"
)

func main() {
    config.ConnectDB()
    
    colls := []string{"books", "inventory", "physical_copies", "loans", "members"}
    
    fmt.Println("=== COLLECTION STATS ===")
    for _, name := range colls {
        count, err := config.GetCollection(name).CountDocuments(context.TODO(), bson.M{})
        if err != nil {
            fmt.Printf("%s: Error %v\n", name, err)
        } else {
            fmt.Printf("%s: %d documents\n", name, count)
        }
    }
}
