package main

// Force rebuild 7439
// Fixed BorrowBook duplication
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
			auth.Use(middleware.AuthMiddleware())
			auth.PUT("/profile", controllers.UpdateProfile)
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
			loans.GET("/my-quota", controllers.GetMyQuota)
			loans.PUT("/return/:id", controllers.ReturnBook)
			loans.PUT("/schedule-return/:id", controllers.UpdateReturnAppointment)
			loans.PUT("/renew/:id", controllers.RenewLoan)
			
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
		stats.GET("/members", controllers.GetBranchMemberStats)
		stats.GET("/circulation", controllers.GetBranchCirculationStats)
	}


	// VIP Routes
	vip := api.Group("/vip")
	{
		vip.GET("/packages", controllers.GetVIPPackages) // Public
		vip.Use(middleware.AuthMiddleware())
		vip.GET("/status", controllers.GetVIPStatus)
		vip.POST("/purchase", controllers.PurchaseVIP)
	}

	// Admin Routes (Admin/Staff only)
	admin := api.Group("/admin")
	admin.Use(middleware.AuthMiddleware())
	{
		admin.GET("/members", controllers.GetAllMembers)           // Admin/Staff
		admin.POST("/grant-vip/:memberId", controllers.GrantVIP)   // Admin/Staff
		admin.POST("/promote-role/:memberId", controllers.PromoteRole) // Admin only
		admin.DELETE("/revoke-vip/:memberId", controllers.RevokeVIP)   // Admin/Staff
		admin.POST("/downgrade-role/:memberId", controllers.DowngradeRole) // Admin only
		admin.POST("/assign-branch/:memberId", controllers.AssignBranch)   // Admin only
		// Book Management
		admin.POST("/books", controllers.AddBook)                     // Admin only
		admin.GET("/books/:id/physical-copies", controllers.GetBookPhysicalCopies) // NEW
		admin.PUT("/physical-copies/:id", controllers.UpdatePhysicalCopy) // NEW
		admin.GET("/books/:id/license", controllers.GetBookLicense)   // Admin only
		admin.PUT("/books/:id", controllers.UpdateBook)               // Admin only
		admin.DELETE("/books/:id", controllers.DeleteBook)            // Admin only
		admin.POST("/inventory", controllers.AddInventory)            // Admin only
		admin.GET("/inventory", controllers.GetInventory)             // Admin/Staff
		
		// Policy Management
		admin.GET("/policy", controllers.GetPolicy)                   // Admin only
		admin.PUT("/policy", controllers.UpdatePolicy)                // Admin only
	}

	// Staff Routes
	staff := api.Group("/staff")
	staff.Use(middleware.AuthMiddleware())
	{
		staff.PUT("/inventory/:bookId", controllers.UpdateInventory)  // Staff only
		staff.GET("/inventory", controllers.GetInventory)       // Staff only
	}

	r.Run(":8081")
}
