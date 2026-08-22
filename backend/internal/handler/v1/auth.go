package v1

import (
	"erp/internal/middleware"
	"erp/internal/pkg/authjwt"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/response"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
)

// AuthHandler 登录相关 HTTP 处理器。
type AuthHandler struct {
	accountService service.AccountService
	jwtManager     *authjwt.Manager
}

// NewAuthHandler 创建登录处理器。
func NewAuthHandler(accountService service.AccountService, jwtManager *authjwt.Manager) *AuthHandler {
	return &AuthHandler{
		accountService: accountService,
		jwtManager:     jwtManager,
	}
}

// LoginRequest 登录请求体。
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录成功响应。
type LoginResponse struct {
	Token              string `json:"token"`
	ExpiresAt          string `json:"expires_at"`
	AccountID          uint   `json:"account_id"`
	Username           string `json:"username"`
	Nickname           string `json:"nickname"`
	Role               string `json:"role"`
	MustChangePassword bool   `json:"must_change_password"`
}

// ConfirmPasswordRequest 二次确认密码。
type ConfirmPasswordRequest struct {
	Password string `json:"password" binding:"required"`
}

// SetupPasswordRequest 首次设置密码。
type SetupPasswordRequest struct {
	Password string `json:"password" binding:"required,min=6"`
}

// ChangePasswordRequest 当前用户修改密码。
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// Login 用户名密码登录
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入用户名和密码")
		return
	}

	account, err := h.accountService.Authenticate(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	token, expiresAt, err := h.jwtManager.Sign(
		account.ID, account.Username, account.Nickname, account.Role, account.MustChangePassword,
	)
	if err != nil {
		response.InternalError(c, "签发登录凭证失败")
		return
	}

	response.Success(c, LoginResponse{
		Token:              token,
		ExpiresAt:          expiresAt.Format("2006-01-02 15:04:05"),
		AccountID:          account.ID,
		Username:           account.Username,
		Nickname:           account.Nickname,
		Role:               rbac.NormalizeRole(account.Role),
		MustChangePassword: account.MustChangePassword,
	})
}

// ConfirmPassword 校验当前登录用户密码。
func (h *AuthHandler) ConfirmPassword(c *gin.Context) {
	var req ConfirmPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入密码")
		return
	}
	claims := middleware.GetAuthClaims(c)
	if claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	if err := h.accountService.VerifyPassword(c.Request.Context(), claims.AccountID, req.Password); err != nil {
		response.Forbidden(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "密码校验通过", nil)
}

// SetupPassword 首次登录设置密码。
func (h *AuthHandler) SetupPassword(c *gin.Context) {
	var req SetupPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入至少 6 位的新密码")
		return
	}
	claims := middleware.GetAuthClaims(c)
	if claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	account, err := h.accountService.SetupPassword(c.Request.Context(), claims.AccountID, req.Password)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	token, expiresAt, err := h.jwtManager.Sign(
		account.ID, account.Username, account.Nickname, account.Role, account.MustChangePassword,
	)
	if err != nil {
		response.InternalError(c, "签发登录凭证失败")
		return
	}
	response.Success(c, LoginResponse{
		Token:              token,
		ExpiresAt:          expiresAt.Format("2006-01-02 15:04:05"),
		AccountID:          account.ID,
		Username:           account.Username,
		Nickname:           account.Nickname,
		Role:               rbac.NormalizeRole(account.Role),
		MustChangePassword: account.MustChangePassword,
	})
}

// SkipPasswordSetup 放弃设置新密码，沿用当前密码进入系统。
func (h *AuthHandler) SkipPasswordSetup(c *gin.Context) {
	claims := middleware.GetAuthClaims(c)
	if claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	account, err := h.accountService.SkipPasswordSetup(c.Request.Context(), claims.AccountID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	token, expiresAt, err := h.jwtManager.Sign(
		account.ID, account.Username, account.Nickname, account.Role, account.MustChangePassword,
	)
	if err != nil {
		response.InternalError(c, "签发登录凭证失败")
		return
	}
	response.Success(c, LoginResponse{
		Token:              token,
		ExpiresAt:          expiresAt.Format("2006-01-02 15:04:05"),
		AccountID:          account.ID,
		Username:           account.Username,
		Nickname:           account.Nickname,
		Role:               rbac.NormalizeRole(account.Role),
		MustChangePassword: account.MustChangePassword,
	})
}

// ChangePassword 当前登录用户修改自己的密码。
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请填写当前密码，以及至少 6 位的新密码")
		return
	}
	claims := middleware.GetAuthClaims(c)
	if claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	if _, err := h.accountService.ChangePassword(
		c.Request.Context(), claims.AccountID, req.OldPassword, req.NewPassword,
	); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "密码已修改", nil)
}
