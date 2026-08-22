// Package v1 注册 API v1 路由分组。
package v1

import (
	v1handler "erp/internal/handler/v1"
	"erp/internal/middleware"
	"erp/internal/pkg/authjwt"
	"erp/internal/pkg/rbac"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册 v1 版本全部路由。
func RegisterRoutes(rg *gin.RouterGroup, accountHandler *v1handler.AccountHandler, authHandler *v1handler.AuthHandler, jwtManager *authjwt.Manager) {
	auth := rg.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/confirm-password", middleware.Auth(jwtManager), authHandler.ConfirmPassword)
		auth.POST("/setup-password", middleware.Auth(jwtManager), authHandler.SetupPassword)
		auth.POST("/skip-password-setup", middleware.Auth(jwtManager), authHandler.SkipPasswordSetup)
		auth.POST("/change-password", middleware.Auth(jwtManager), middleware.RequirePasswordSetupDone(), authHandler.ChangePassword)
	}

	accounts := rg.Group("/accounts", middleware.Auth(jwtManager), middleware.RequirePasswordSetupDone(), middleware.RequireRoles(rbac.RoleAdmin))
	{
		accounts.POST("", accountHandler.CreateAccount)
		accounts.GET("", accountHandler.ListAccounts)
		accounts.GET("/:id", accountHandler.GetAccount)
		accounts.PUT("/:id", accountHandler.UpdateAccount)
		accounts.POST("/:id/reset-password", accountHandler.ResetPassword)
		accounts.DELETE("/:id", accountHandler.DeleteAccount)
	}
}
