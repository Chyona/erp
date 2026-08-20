// Package v1 注册 API v1 路由分组。
package v1

import (
	v1handler "base/internal/handler/v1"
	"base/internal/middleware"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册 v1 版本全部路由。
func RegisterRoutes(rg *gin.RouterGroup, accountHandler *v1handler.AccountHandler) {
	// 账号路由
	accounts := rg.Group("/accounts")
	{
		accounts.POST("", accountHandler.CreateAccount)
		accounts.GET("", accountHandler.ListAccounts)
		accounts.GET("/:id", accountHandler.GetAccount)
		accounts.PUT("/:id", middleware.Auth(), accountHandler.UpdateAccount)
		accounts.DELETE("/:id", middleware.Auth(), accountHandler.DeleteAccount)
	}
}
