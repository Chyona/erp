// Package v1 提供 API v1 版本的 HTTP 处理器。
package v1

import (
	"strconv"
	"strings"

	"erp/internal/middleware"
	"erp/internal/pkg/response"
	"erp/internal/pkg/utils"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
)

// AccountHandler 账号相关 HTTP 处理器。
type AccountHandler struct {
	accountService service.AccountService
}

// NewAccountHandler 创建账号处理器实例。
func NewAccountHandler(accountService service.AccountService) *AccountHandler {
	return &AccountHandler{accountService: accountService}
}

// CreateAccountRequest 创建账号请求体。
type CreateAccountRequest struct {
	Username string `json:"username" binding:"required"`
	Email    *string `json:"email"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
	Role     string `json:"role"`
}

// UpdateAccountRequest 更新账号请求体。
type UpdateAccountRequest struct {
	Nickname *string `json:"nickname"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
	Remark   *string `json:"remark"`
	Role     *string `json:"role"`
	Status   *int8   `json:"status"`
}

// ResetPasswordRequest 管理员重置密码。
type ResetPasswordRequest struct {
	Password string `json:"password" binding:"required,min=6"`
}

// CreateAccount 创建账号
// @Summary      创建账号
// @Description  注册新账号
// @Tags         账号
// @Accept       json
// @Produce      json
// @Param        body  body      CreateAccountRequest  true  "账号信息"
// @Success      200   {object}  response.Body
// @Failure      400   {object}  response.Body
// @Router       /v1/users [post]
func (h *AccountHandler) CreateAccount(c *gin.Context) {
	var req CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	account, err := h.accountService.CreateAccount(
		c.Request.Context(), req.Username, optionalEmail(req.Email), req.Password, req.Nickname, req.Role,
	)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, account)
}

// GetAccount 获取账号详情
// @Summary      获取账号详情
// @Description  根据 ID 查询账号
// @Tags         账号
// @Produce      json
// @Param        id   path      int  true  "账号 ID"
// @Success      200  {object}  response.Body
// @Failure      404  {object}  response.Body
// @Router       /v1/users/{id} [get]
func (h *AccountHandler) GetAccount(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的账号 ID")
		return
	}

	account, err := h.accountService.GetAccount(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, account)
}

// ListAccounts 账号列表
// @Summary      账号列表
// @Description  分页查询账号
// @Tags         账号
// @Produce      json
// @Param        page       query     int  false  "页码"
// @Param        page_size  query     int  false  "每页数量"
// @Success      200        {object}  response.Body
// @Router       /v1/users [get]
func (h *AccountHandler) ListAccounts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	page, pageSize = utils.DefaultPage(page, pageSize)

	accounts, total, err := h.accountService.ListAccounts(c.Request.Context(), page, pageSize)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, response.PageData{
		List:     accounts,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// UpdateAccount 更新账号
// @Summary      更新账号
// @Description  更新账号昵称、邮箱、手机、备注或角色状态
// @Tags         账号
// @Accept       json
// @Produce      json
// @Param        id    path      int                   true  "账号 ID"
// @Param        body  body      UpdateAccountRequest  true  "更新内容"
// @Success      200   {object}  response.Body
// @Router       /v1/users/{id} [put]
func (h *AccountHandler) UpdateAccount(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的账号 ID")
		return
	}

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	account, err := h.accountService.UpdateAccount(c.Request.Context(), id, service.UpdateAccountPatch{
		Nickname: req.Nickname,
		Email:    req.Email,
		Phone:    req.Phone,
		Remark:   req.Remark,
		Role:     req.Role,
		Status:   req.Status,
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, account)
}

// ResetPassword 管理员重置密码
func (h *AccountHandler) ResetPassword(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的账号 ID")
		return
	}
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请输入至少 6 位的新密码")
		return
	}
	claims := middleware.GetAuthClaims(c)
	// 改自己的密码：直接生效；重置他人：对方下次登录需再设密
	requireReSetup := claims == nil || claims.AccountID != id
	account, err := h.accountService.ResetPassword(c.Request.Context(), id, req.Password, requireReSetup)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	msg := "密码已重置，用户下次登录需重新设置密码"
	if !requireReSetup {
		msg = "密码已修改"
	}
	response.SuccessWithMessage(c, msg, account)
}

// DeleteAccount 删除账号
// @Summary      删除账号
// @Description  软删除账号
// @Tags         账号
// @Produce      json
// @Param        id   path      int  true  "账号 ID"
// @Success      200  {object}  response.Body
// @Router       /v1/users/{id} [delete]
func (h *AccountHandler) DeleteAccount(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.BadRequest(c, "无效的账号 ID")
		return
	}

	if err := h.accountService.DeleteAccount(c.Request.Context(), id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

func parseUintParam(c *gin.Context, name string) (uint, error) {
	v, err := strconv.ParseUint(c.Param(name), 10, 64)
	return uint(v), err
}

func optionalEmail(raw *string) string {
	if raw == nil {
		return ""
	}
	return strings.TrimSpace(*raw)
}
