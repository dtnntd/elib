package models

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Book struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ISBN          string             `bson:"isbn" json:"isbn"`
	Title         string             `bson:"title" json:"title"`
	Authors       []string           `bson:"authors" json:"authors"`
	Subjects      []string           `bson:"subjects" json:"subjects"` // [CategoryName, Topic, Code]
	LCCCode       string             `bson:"lcc_code" json:"lccCode"`
	Publisher     string             `bson:"publisher" json:"publisher"`
	PublishedYear int                `bson:"publishedYear" json:"publishedYear"`
	Price         int                `bson:"price" json:"price"`
	Lang          string             `bson:"lang" json:"lang"`
	Description   string             `bson:"description" json:"description"`
}

// For Detail View: Includes availability stats
type BookDetail struct {
	Book
	AvailableCopies int  `json:"availableCopies"`
	TotalCopies     int  `json:"totalCopies"`
	HasEbook        bool `json:"hasEbook"`
}
