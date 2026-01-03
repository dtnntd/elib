package main

import (
	"elibrary-api/config"
	"elibrary-api/controllers"
	"elibrary-api/middleware"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Connect DB
	config.ConnectDB()

	// 2. Setup Router
	r := gin.Default()

	// 3. CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 4. Routes
	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", controllers.Login)
			auth.POST("/register", controllers.Register)
		}
		
		books := api.Group("/books")
		{
			books.GET("", controllers.GetBooks)
			books.GET("/:id", controllers.GetBook)
		}
		
		loans := api.Group("/loans")
		loans.Use(middleware.AuthMiddleware())
		{
			loans.POST("/borrow", controllers.BorrowBook)
			loans.GET("/my-loans", controllers.GetMyLoans)
			loans.PUT("/return/:id", controllers.ReturnBook)
			loans.PUT("/schedule-return/:id", controllers.UpdateReturnAppointment)
			
			// Staff Routes
			loans.GET("/all", controllers.GetAllLoans)
			loans.PUT("/checkout/:id", controllers.ConfirmPickup)
		}
	}
	
	wallet := api.Group("/wallet")
	wallet.Use(middleware.AuthMiddleware())
	{
		wallet.POST("/topup", controllers.TopUp)
		wallet.GET("/history", controllers.GetWalletHistory)
		wallet.GET("/balance", controllers.GetWalletBalance)
	}

	stats := api.Group("/stats")
	stats.Use(middleware.AuthMiddleware()) // Ideally check for Staff Role
	{
		stats.GET("/dashboard", controllers.GetDashboardStats)
		stats.GET("/trends", controllers.GetMonthlyTrends)
	}

	r.Run(":8081")
}
