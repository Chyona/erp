package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

var defaultDevCORSOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:4173",
	"http://127.0.0.1:4173",
}

// CORS 按白名单允许跨域；debug 且无配置时放行本地前端 Origin。
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[strings.TrimSpace(origin)] = struct{}{}
	}
	allowDevFallback := len(allowed) == 0 && gin.Mode() == gin.DebugMode

	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		if origin != "" {
			if _, ok := allowed[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			} else if allowDevFallback {
				for _, devOrigin := range defaultDevCORSOrigins {
					if origin == devOrigin {
						c.Header("Access-Control-Allow-Origin", origin)
						c.Header("Vary", "Origin")
						break
					}
				}
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, User-Agent")
		c.Header("Access-Control-Expose-Headers", "Content-Disposition")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
