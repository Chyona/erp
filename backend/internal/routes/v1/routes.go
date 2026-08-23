// Package v1 注册 API v1 路由分组。
package v1

import (
	v1handler "erp/internal/handler/v1"
	v2handler "erp/internal/handler/v2"
	"erp/internal/middleware"
	"erp/internal/pkg/authjwt"
	"erp/internal/pkg/rbac"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册平台路由（认证、系统用户等，挂载于 /openapi/erp/v1）。
func RegisterRoutes(
	rg *gin.RouterGroup,
	accountHandler *v1handler.AccountHandler,
	authHandler *v1handler.AuthHandler,
	profileHandler *v2handler.AccountHandler,
	jwtManager *authjwt.Manager,
) {
	auth := rg.Group("/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/confirm-password", middleware.Auth(jwtManager), authHandler.ConfirmPassword)
		auth.POST("/setup-password", middleware.Auth(jwtManager), authHandler.SetupPassword)
		auth.POST("/skip-password-setup", middleware.Auth(jwtManager), authHandler.SkipPasswordSetup)
		auth.POST("/change-password", middleware.Auth(jwtManager), middleware.RequirePasswordSetupDone(), authHandler.ChangePassword)
	}

	users := rg.Group("/users", middleware.Auth(jwtManager), middleware.RequirePasswordSetupDone(), middleware.RequireRoles(rbac.RoleAdmin))
	{
		users.POST("", accountHandler.CreateAccount)
		users.GET("", accountHandler.ListAccounts)
		users.GET("/:id/profile", profileHandler.GetAccountProfile)
		users.GET("/:id", accountHandler.GetAccount)
		users.PUT("/:id", accountHandler.UpdateAccount)
		users.POST("/:id/reset-password", accountHandler.ResetPassword)
		users.DELETE("/:id", accountHandler.DeleteAccount)
	}
}
