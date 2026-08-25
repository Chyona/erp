package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"erp/internal/pkg/response"
	"github.com/gin-gonic/gin"
)

const (
	loginRateLimitWindow = 15 * time.Minute
	loginRateLimitMax    = 10
)

type loginRateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
}

func newLoginRateLimiter() *loginRateLimiter {
	return &loginRateLimiter{attempts: make(map[string][]time.Time)}
}

func (l *loginRateLimiter) allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-loginRateLimitWindow)

	l.mu.Lock()
	defer l.mu.Unlock()

	history := l.attempts[key]
	filtered := history[:0]
	for _, ts := range history {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}
	if len(filtered) >= loginRateLimitMax {
		l.attempts[key] = filtered
		return false
	}
	filtered = append(filtered, now)
	l.attempts[key] = filtered
	return true
}

func clientIP(c *gin.Context) string {
	if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	return c.ClientIP()
}

var defaultLoginRateLimiter = newLoginRateLimiter()

// DefaultLoginRateLimit 默认登录限速（15 分钟内最多 10 次）。
func DefaultLoginRateLimit() gin.HandlerFunc {
	return LoginRateLimit(defaultLoginRateLimiter)
}

// LoginRateLimit 限制登录接口暴力破解。
func LoginRateLimit(limiter *loginRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := clientIP(c)
		if !limiter.allow(key) {
			response.Fail(c, http.StatusTooManyRequests, 429, "登录尝试过于频繁，请稍后再试")
			c.Abort()
			return
		}
		c.Next()
	}
}
