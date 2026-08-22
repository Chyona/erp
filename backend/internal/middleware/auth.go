package middleware

import (
	"strings"

	"erp/internal/pkg/authjwt"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/response"
	"github.com/gin-gonic/gin"
)

const authHeaderKey = "Authorization"
const authContextKey = "auth_claims"

// Auth JWT Bearer 鉴权中间件。
func Auth(jwtManager *authjwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader(authHeaderKey)
		if header == "" {
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Unauthorized(c, "登录状态无效，请重新登录")
			c.Abort()
			return
		}

		token := strings.TrimSpace(parts[1])
		if token == "" {
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}

		claims, err := jwtManager.Parse(token)
		if err != nil {
			response.Unauthorized(c, err.Error())
			c.Abort()
			return
		}

		c.Set(authContextKey, claims)
		c.Request = c.Request.WithContext(rbac.WithActor(c.Request.Context(), claims.ToActor()))
		c.Next()
	}
}

// RequireRoles 仅允许指定角色继续。
func RequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[rbac.NormalizeRole(r)] = struct{}{}
	}
	return func(c *gin.Context) {
		claims := GetAuthClaims(c)
		if claims == nil {
			response.Unauthorized(c, "请先登录")
			c.Abort()
			return
		}
		role := rbac.NormalizeRole(claims.Role)
		if _, ok := allowed[role]; !ok {
			response.Forbidden(c, "当前账号无权限执行此操作")
			c.Abort()
			return
		}
		c.Next()
	}
}

// DenyReadonlyOnMutate 禁止只读用户发起写请求；GET 与 /app/init 放行。
func DenyReadonlyOnMutate() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetAuthClaims(c)
		if claims == nil || rbac.NormalizeRole(claims.Role) != rbac.RoleReadonly {
			c.Next()
			return
		}
		method := c.Request.Method
		path := c.Request.URL.Path
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			c.Next()
			return
		}
		if method == "POST" && strings.HasSuffix(path, "/app/init") {
			c.Next()
			return
		}
		response.Forbidden(c, "只读账号无权修改数据")
		c.Abort()
	}
}

// RequirePasswordSetupDone 未完成首次设密时，禁止访问业务接口。
func RequirePasswordSetupDone() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetAuthClaims(c)
		if claims == nil || !claims.MustChangePassword {
			c.Next()
			return
		}
		response.Forbidden(c, "请先设置登录密码")
		c.Abort()
	}
}

// GetAuthClaims 从上下文获取已认证用户声明。
func GetAuthClaims(c *gin.Context) *authjwt.Claims {
	if v, ok := c.Get(authContextKey); ok {
		if claims, ok := v.(*authjwt.Claims); ok {
			return claims
		}
	}
	return nil
}

// GetAuthAccount 从上下文获取已认证账号名。
func GetAuthAccount(c *gin.Context) string {
	if claims := GetAuthClaims(c); claims != nil {
		return claims.Username
	}
	return ""
}

// GetActor 从上下文获取 rbac.Actor。
func GetActor(c *gin.Context) *rbac.Actor {
	if claims := GetAuthClaims(c); claims != nil {
		return claims.ToActor()
	}
	return rbac.ActorFrom(c.Request.Context())
}
