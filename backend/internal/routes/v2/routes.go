// Package v2 注册 API v2 路由分组。
package v2

import (
	v2handler "base/internal/handler/v2"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册 v2 版本全部路由。
func RegisterRoutes(rg *gin.RouterGroup, accountHandler *v2handler.AccountHandler) {
	accounts := rg.Group("/accounts")
	{
		accounts.GET("/:id/profile", accountHandler.GetAccountProfile)
	}
}
