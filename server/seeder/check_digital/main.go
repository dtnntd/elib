package main

import (
    "context"
    "fmt"
    "elibrary-api/config"
    "go.mongodb.org/mongo-driver/bson"
)

func main() {
    config.ConnectDB()
    coll := config.GetCollection("books")
    
    // list distinct "digitalType"
    types, err := coll.Distinct(context.TODO(), "digitalType", bson.M{})
    if err != nil {
        fmt.Println("Error:", err)
        return
    }
    
    fmt.Println("Found Digital Types:", types)

    // Also check "concurrentLimit" just in case
    limits, _ := coll.Distinct(context.TODO(), "concurrentLimit", bson.M{})
    fmt.Println("Found Concurrent Limits:", limits) // Might be many, just curious if field exists
}
