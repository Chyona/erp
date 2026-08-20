package middleware

import (
	"strings"

	"base/pkg/response"
	"github.com/gin-gonic/gin"
)

const authHeaderKey = "Authorization"
const authContextKey = "account"

// Auth 简单 Bearer Token 鉴权中间件（示例实现）。
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader(authHeaderKey)
		if header == "" {
			response.Unauthorized(c, "缺少 Authorization 请求头")
			c.Abort()
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Unauthorized(c, "Authorization 格式错误，应为 Bearer <token>")
			c.Abort()
			return
		}

		token := parts[1]
		if token == "" {
			response.Unauthorized(c, "Token 不能为空")
			c.Abort()
			return
		}

		// 示例：固定 token 校验，生产环境应替换为 JWT 等方案
		if token != "demo-token" {
			response.Unauthorized(c, "Token 无效")
			c.Abort()
			return
		}

		c.Set(authContextKey, "demo")
		c.Next()
	}
}

// GetAuthAccount 从上下文获取已认证账号名。
func GetAuthAccount(c *gin.Context) string {
	if v, ok := c.Get(authContextKey); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
