package v1

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"erp/internal/middleware"
	"erp/internal/model"
	"erp/internal/pkg/response"
	"erp/internal/pkg/utils"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
)

// ErpHandler ERP HTTP 处理器，对应前端 ErpApi（services/erpApi.ts）。
type ErpHandler struct {
	erpService     service.ErpService
	accountService service.AccountService
}

func NewErpHandler(erpService service.ErpService, accountService service.AccountService) *ErpHandler {
	return &ErpHandler{erpService: erpService, accountService: accountService}
}

func requireAdmin(c *gin.Context) bool {
	actor := middleware.GetActor(c)
	if actor == nil {
		return true
	}
	if !actor.IsAdmin() {
		response.Forbidden(c, "需要管理员权限")
		return false
	}
	return true
}

func requireExport(c *gin.Context) bool {
	actor := middleware.GetActor(c)
	if actor == nil {
		return true
	}
	if !actor.CanExport() {
		response.Forbidden(c, "当前账号无权导出或备份")
		return false
	}
	return true
}

// requireAdminDeletePassword 保留兼容 confirmPassword 字段；已登录管理员凭 JWT 即可删除，不再二次验密。
func (h *ErpHandler) requireAdminDeletePassword(c *gin.Context, _ string) bool {
	return true
}

func (h *ErpHandler) writeAudit(c *gin.Context, action, target, details string) {
	_, _ = h.erpService.AddAuditLog(c.Request.Context(), action, target, details, c.GetHeader("User-Agent"))
}

// formatVoucherAuditDetail 生成可读的凭证审计详情（号/日期/摘要/金额）。
func formatVoucherAuditDetail(v *model.Voucher) string {
	if v == nil {
		return "未知凭证"
	}
	parts := make([]string, 0, 5)
	no := strings.TrimSpace(v.VoucherNo)
	if no == "" {
		no = strings.TrimSpace(v.VoucherType + "-" + v.VoucherNumber)
	}
	if no == "" || no == "-" {
		no = v.ID
	}
	parts = append(parts, no)
	if d := strings.TrimSpace(v.Date); d != "" {
		parts = append(parts, "日期 "+d)
	}
	if summary := voucherEntrySummaries([]byte(v.Entries)); summary != "" {
		parts = append(parts, "摘要「"+summary+"」")
	} else if r := strings.TrimSpace(v.Remark); r != "" {
		parts = append(parts, "备注「"+r+"」")
	}
	if v.TotalDebit > 0 {
		parts = append(parts, "金额 "+strconv.FormatFloat(v.TotalDebit, 'f', 2, 64))
	}
	if bt := strings.TrimSpace(v.BusinessType); bt != "" {
		parts = append(parts, "业务 "+bt)
	}
	return strings.Join(parts, "，")
}

func voucherEntrySummaries(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var entries []struct {
		Summary string `json:"summary"`
	}
	if err := json.Unmarshal(raw, &entries); err != nil {
		return ""
	}
	seen := map[string]struct{}{}
	list := make([]string, 0, 2)
	for _, e := range entries {
		s := strings.TrimSpace(e.Summary)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		list = append(list, s)
		if len(list) >= 2 {
			break
		}
	}
	if len(list) == 0 {
		return ""
	}
	if len(seen) > len(list) {
		return strings.Join(list, "；") + "等"
	}
	return strings.Join(list, "；")
}

type setSettingRequest struct {
	Value json.RawMessage `json:"value"`
}

type addAuditLogRequest struct {
	Action  string `json:"action" binding:"required"`
	Target  string `json:"target"`
	Details string `json:"details"`
}

type batchIDsRequest struct {
	IDs             []string `json:"ids" binding:"required"`
	ConfirmPassword string   `json:"confirmPassword"`
}

// voucherBatchRequest 凭证统一批量入口：action 区分操作，ids/items 均为数组（1 条即单条）。
type voucherBatchRequest struct {
	Action          string          `json:"action" binding:"required"`
	IDs             []string        `json:"ids"`
	Items           []model.Voucher `json:"items"`
	ConfirmPassword string          `json:"confirmPassword"`
}

type batchAttachmentsRequest struct {
	Action string             `json:"action"`
	IDs    []string           `json:"ids"`
	Items  []model.Attachment `json:"items"`
}

type batchAccountsRequest struct {
	Action string               `json:"action"`
	IDs    []string             `json:"ids"`
	Items  []model.ChartAccount `json:"items"`
}

type batchSettingsRequest struct {
	Items []service.SettingKV `json:"items" binding:"required"`
}

// ListChartAccounts GET /accounts — 列出全部会计科目。
func (h *ErpHandler) ListChartAccounts(c *gin.Context) {
	items, err := h.erpService.ListChartAccounts(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// GetChartAccount GET /accounts/:id — 按 ID 查询科目。
func (h *ErpHandler) GetChartAccount(c *gin.Context) {
	item, err := h.erpService.GetChartAccount(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

// SaveChartAccount PUT /accounts/:id — 新增或更新科目（路径 ID 覆盖 body）。
func (h *ErpHandler) SaveChartAccount(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var item model.ChartAccount
	if err := c.ShouldBindJSON(&item); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	item.ID = c.Param("id")
	saved, err := h.erpService.SaveChartAccount(c.Request.Context(), &item)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	h.writeAudit(c, "保存科目", item.ID, item.Code+" "+item.Name)
	response.Success(c, saved)
}

// DeleteChartAccount DELETE /accounts/:id — 删除单条科目。
func (h *ErpHandler) DeleteChartAccount(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	if err := h.erpService.DeleteChartAccount(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "删除科目", c.Param("id"), "")
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearChartAccounts DELETE /accounts — 清空全部科目。
func (h *ErpHandler) ClearChartAccounts(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	if err := h.erpService.ClearChartAccounts(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "清空科目", "全部", "")
	response.SuccessWithMessage(c, "已清空科目", nil)
}

// SaveChartAccountsBatch POST|PUT /accounts/batch — action=upsert|delete（缺省时有 items 则 upsert）。
func (h *ErpHandler) SaveChartAccountsBatch(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var req batchAccountsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	action := req.Action
	if action == "" {
		if len(req.Items) > 0 {
			action = "upsert"
		} else if len(req.IDs) > 0 {
			action = "delete"
		}
	}
	switch action {
	case "upsert":
		if len(req.Items) == 0 {
			response.Success(c, gin.H{"action": "upsert", "count": 0, "items": []model.ChartAccount{}})
			return
		}
		saved, err := h.erpService.SaveChartAccountsBatch(c.Request.Context(), req.Items)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		h.writeAudit(c, "批量保存科目", "batch", strconv.Itoa(len(saved))+" 条")
		response.Success(c, gin.H{"action": "upsert", "count": len(saved), "items": saved})
	case "delete":
		if err := h.erpService.DeleteChartAccountsBatch(c.Request.Context(), req.IDs); err != nil {
			response.InternalError(c, err.Error())
			return
		}
		h.writeAudit(c, "批量删除科目", "batch", strconv.Itoa(len(req.IDs))+" 条")
		response.Success(c, gin.H{"action": "delete", "count": len(req.IDs), "ids": req.IDs})
	default:
		response.BadRequest(c, "action 仅支持 upsert 或 delete")
	}
}

// DeleteChartAccountsBatch 兼容旧 DELETE /accounts/batch。
func (h *ErpHandler) DeleteChartAccountsBatch(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var req batchIDsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.erpService.DeleteChartAccountsBatch(c.Request.Context(), req.IDs); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "批量删除科目", "batch", strconv.Itoa(len(req.IDs))+" 条")
	response.Success(c, gin.H{"action": "delete", "count": len(req.IDs), "ids": req.IDs})
}

// ListVouchers GET /vouchers — 列出凭证；带 page 参数时返回分页结果。
func (h *ErpHandler) ListVouchers(c *gin.Context) {
	if c.Query("page") != "" {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
		page, pageSize = utils.DefaultPage(page, pageSize)
		q := service.VoucherListQuery{
			Page:          page,
			PageSize:      pageSize,
			StartDate:     c.Query("start_date"),
			EndDate:       c.Query("end_date"),
			Status:        c.Query("status"),
			VoucherType:   c.Query("voucher_type"),
			VoucherNumber: c.Query("voucher_number"),
			Summary:       c.Query("summary"),
			AccountCode:   c.Query("account_code"),
			AmountMin:     c.Query("amount_min"),
			AmountMax:     c.Query("amount_max"),
			BusinessType:  c.Query("business_type"),
			Signatory:     c.Query("signatory"),
			Remark:        c.Query("remark"),
			Keyword:       c.Query("keyword"),
		}
		items, total, err := h.erpService.ListVouchersPage(c.Request.Context(), q)
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}
		response.Success(c, response.PageData{
			List:     items,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		})
		return
	}

	items, err := h.erpService.ListVouchers(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// VouchersBatch POST /vouchers/batch — 统一批量入口。
// action=upsert 用 items；approve|unapprove|delete 用 ids；数组长度为 1 即单条。
func (h *ErpHandler) VouchersBatch(c *gin.Context) {
	var req voucherBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	ctx := c.Request.Context()
	switch req.Action {
	case "upsert":
		if len(req.Items) == 0 {
			response.Success(c, gin.H{"action": "upsert", "count": 0, "items": []model.Voucher{}})
			return
		}
		saved, err := h.erpService.SaveVouchersBatch(ctx, req.Items)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		response.Success(c, gin.H{"action": "upsert", "count": len(saved), "items": saved})
	case "approve":
		if !requireAdmin(c) {
			return
		}
		result, err := h.erpService.ApproveVouchersBatch(ctx, req.IDs)
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}
		result.Action = "approve"
		h.writeAudit(c, "审核凭证", "batch", "批准 "+strconv.Itoa(result.Approved)+" 张")
		response.Success(c, result)
	case "unapprove":
		if !requireAdmin(c) {
			return
		}
		result, err := h.erpService.UnapproveVouchersBatch(ctx, req.IDs)
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}
		result.Action = "unapprove"
		h.writeAudit(c, "反审核凭证", "batch", "反审核 "+strconv.Itoa(result.Unapproved)+" 张")
		response.Success(c, result)
	case "delete":
		if !h.requireAdminDeletePassword(c, req.ConfirmPassword) {
			return
		}
		result, err := h.erpService.DeleteVouchersBatch(ctx, req.IDs)
		if err != nil {
			response.InternalError(c, err.Error())
			return
		}
		result.Action = "delete"
		h.writeAudit(c, "删除凭证", "batch", "删除 "+strconv.Itoa(result.Deleted)+" 张")
		response.Success(c, result)
	default:
		response.BadRequest(c, "action 仅支持 upsert、approve、unapprove、delete")
	}
}

// SaveVouchersBatch 兼容旧 PUT /vouchers/batch。
func (h *ErpHandler) SaveVouchersBatch(c *gin.Context) {
	var req struct {
		Items []model.Voucher `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	saved, err := h.erpService.SaveVouchersBatch(c.Request.Context(), req.Items)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"action": "upsert", "count": len(saved), "items": saved})
}

// DeleteVouchersBatch 兼容旧 DELETE /vouchers/batch。
func (h *ErpHandler) DeleteVouchersBatch(c *gin.Context) {
	var req batchIDsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if !h.requireAdminDeletePassword(c, req.ConfirmPassword) {
		return
	}
	result, err := h.erpService.DeleteVouchersBatch(c.Request.Context(), req.IDs)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	result.Action = "delete"
	h.writeAudit(c, "删除凭证", "batch", "删除 "+strconv.Itoa(result.Deleted)+" 张")
	response.Success(c, result)
}

// ApproveVouchersBatch 兼容旧路径 POST /vouchers/batch-approve。
func (h *ErpHandler) ApproveVouchersBatch(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var req batchIDsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	result, err := h.erpService.ApproveVouchersBatch(c.Request.Context(), req.IDs)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	result.Action = "approve"
	h.writeAudit(c, "审核凭证", "batch", "批准 "+strconv.Itoa(result.Approved)+" 张")
	response.Success(c, result)
}

// UnapproveVouchersBatch 兼容旧路径 POST /vouchers/batch-unapprove。
func (h *ErpHandler) UnapproveVouchersBatch(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var req batchIDsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	result, err := h.erpService.UnapproveVouchersBatch(c.Request.Context(), req.IDs)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	result.Action = "unapprove"
	h.writeAudit(c, "反审核凭证", "batch", "反审核 "+strconv.Itoa(result.Unapproved)+" 张")
	response.Success(c, result)
}

// GetVoucher GET /vouchers/:id — 按 ID 查询凭证。
func (h *ErpHandler) GetVoucher(c *gin.Context) {
	item, err := h.erpService.GetVoucher(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

// SaveVoucher PUT /vouchers/:id — 新增或更新凭证。
func (h *ErpHandler) SaveVoucher(c *gin.Context) {
	var item model.Voucher
	if err := c.ShouldBindJSON(&item); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	item.ID = c.Param("id")
	saved, err := h.erpService.SaveVoucher(c.Request.Context(), &item)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, saved)
}

// DeleteVoucher DELETE /vouchers/:id — 删除单条凭证。
func (h *ErpHandler) DeleteVoucher(c *gin.Context) {
	var req struct {
		ConfirmPassword string `json:"confirmPassword"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.ConfirmPassword == "" {
		req.ConfirmPassword = c.Query("confirmPassword")
	}
	if !h.requireAdminDeletePassword(c, req.ConfirmPassword) {
		return
	}
	id := c.Param("id")
	detail := id
	if existing, err := h.erpService.GetVoucher(c.Request.Context(), id); err == nil && existing != nil {
		detail = formatVoucherAuditDetail(existing)
	}
	if err := h.erpService.DeleteVoucher(c.Request.Context(), id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	h.writeAudit(c, "删除凭证", "凭证", detail)
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearVouchers DELETE /vouchers — 清空全部凭证。
func (h *ErpHandler) ClearVouchers(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	if err := h.erpService.ClearVouchers(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "清空凭证", "全部", "")
	response.SuccessWithMessage(c, "已清空凭证", nil)
}

// ListAttachments GET /attachments — 列出全部附件。
func (h *ErpHandler) ListAttachments(c *gin.Context) {
	items, err := h.erpService.ListAttachments(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// AttachmentsBatch POST|PUT /attachments/batch — action=upsert|delete。
func (h *ErpHandler) AttachmentsBatch(c *gin.Context) {
	var req batchAttachmentsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	action := req.Action
	if action == "" {
		if len(req.Items) > 0 {
			action = "upsert"
		} else if len(req.IDs) > 0 {
			action = "delete"
		}
	}
	switch action {
	case "upsert":
		if len(req.Items) == 0 {
			response.Success(c, gin.H{"action": "upsert", "count": 0, "items": []model.Attachment{}})
			return
		}
		saved, err := h.erpService.SaveAttachmentsBatch(c.Request.Context(), req.Items)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}
		response.Success(c, gin.H{"action": "upsert", "count": len(saved), "items": saved})
	case "delete":
		if err := h.erpService.DeleteAttachmentsBatch(c.Request.Context(), req.IDs); err != nil {
			response.InternalError(c, err.Error())
			return
		}
		response.Success(c, gin.H{"action": "delete", "count": len(req.IDs), "ids": req.IDs})
	default:
		response.BadRequest(c, "action 仅支持 upsert 或 delete")
	}
}

// DeleteAttachmentsBatch 兼容旧 DELETE /attachments/batch。
func (h *ErpHandler) DeleteAttachmentsBatch(c *gin.Context) {
	var req batchIDsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.erpService.DeleteAttachmentsBatch(c.Request.Context(), req.IDs); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"action": "delete", "count": len(req.IDs), "ids": req.IDs})
}

// GetAttachment GET /attachments/:id — 按 ID 查询附件。
func (h *ErpHandler) GetAttachment(c *gin.Context) {
	item, err := h.erpService.GetAttachment(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

// UploadAttachment POST /attachments/upload — multipart 上传文件到对象存储，库内仅存未签名 URL。
func (h *ErpHandler) UploadAttachment(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请上传 file 字段")
		return
	}
	f, err := fileHeader.Open()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	defer f.Close()

	id := strings.TrimSpace(c.PostForm("id"))
	name := strings.TrimSpace(c.PostForm("name"))
	voucherDate := strings.TrimSpace(c.PostForm("voucherDate"))
	if voucherDate == "" {
		voucherDate = strings.TrimSpace(c.PostForm("date"))
	}
	if name == "" {
		name = fileHeader.Filename
	}
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	saved, err := h.erpService.UploadAttachment(
		c.Request.Context(),
		id,
		name,
		contentType,
		voucherDate,
		f,
		fileHeader.Size,
	)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, saved)
}

// SaveAttachment PUT /attachments/:id — 更新附件元数据（不含文件内容）。
func (h *ErpHandler) SaveAttachment(c *gin.Context) {
	var item model.Attachment
	if err := c.ShouldBindJSON(&item); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	item.ID = c.Param("id")
	saved, err := h.erpService.SaveAttachment(c.Request.Context(), &item)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, saved)
}

// DeleteAttachment DELETE /attachments/:id — 删除单条附件。
func (h *ErpHandler) DeleteAttachment(c *gin.Context) {
	if err := h.erpService.DeleteAttachment(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearAttachments DELETE /attachments — 清空全部附件。
func (h *ErpHandler) ClearAttachments(c *gin.Context) {
	if err := h.erpService.ClearAttachments(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空附件", nil)
}

// ListAuditLogs GET /audit-logs — 列出审计日志（query limit，0 表示全部）。
func (h *ErpHandler) ListAuditLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))
	items, err := h.erpService.ListAuditLogs(c.Request.Context(), limit)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// GetAuditLog GET /audit-logs/:id — 按 ID 查询审计日志。
func (h *ErpHandler) GetAuditLog(c *gin.Context) {
	item, err := h.erpService.GetAuditLog(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

// AddAuditLog POST /audit-logs — 追加审计日志（服务端生成 id/timestamp）。
func (h *ErpHandler) AddAuditLog(c *gin.Context) {
	var req addAuditLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userAgent := c.GetHeader("User-Agent")
	log, err := h.erpService.AddAuditLog(c.Request.Context(), req.Action, req.Target, req.Details, userAgent)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, log)
}

// ClearAuditLogs DELETE /audit-logs — 清空审计日志。
func (h *ErpHandler) ClearAuditLogs(c *gin.Context) {
	if err := h.erpService.ClearAuditLogs(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空审计日志", nil)
}

// ListSettings GET /settings — 列出全部设置。
func (h *ErpHandler) ListSettings(c *gin.Context) {
	items, err := h.erpService.ListSettings(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// SetSettingsBatch PUT /settings/batch — 批量写入设置。
func (h *ErpHandler) SetSettingsBatch(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var req batchSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	saved, err := h.erpService.SetSettingsBatch(c.Request.Context(), req.Items)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	h.writeAudit(c, "批量保存设置", "settings", strconv.Itoa(len(saved))+" 项")
	out := make([]gin.H, 0, len(saved))
	for _, item := range saved {
		var decoded interface{}
		_ = json.Unmarshal(item.Value, &decoded)
		out = append(out, gin.H{"key": item.Key, "value": decoded})
	}
	response.Success(c, out)
}

// GetSetting GET /settings/:key — 读取设置；不存在时 value 为 null。
func (h *ErpHandler) GetSetting(c *gin.Context) {
	value, err := h.erpService.GetSetting(c.Request.Context(), c.Param("key"))
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	if value == nil {
		response.Success(c, gin.H{"key": c.Param("key"), "value": nil})
		return
	}
	var decoded interface{}
	if err := json.Unmarshal(value, &decoded); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"key": c.Param("key"), "value": decoded})
}

// SetSetting PUT /settings/:key — 写入设置值。
func (h *ErpHandler) SetSetting(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var req setSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	saved, err := h.erpService.SetSetting(c.Request.Context(), c.Param("key"), req.Value)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	h.writeAudit(c, "保存设置", c.Param("key"), "")
	var decoded interface{}
	_ = json.Unmarshal(saved.Value, &decoded)
	response.Success(c, gin.H{"key": saved.Key, "value": decoded})
}

// DeleteSetting DELETE /settings/:key — 删除单条设置。
func (h *ErpHandler) DeleteSetting(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	if err := h.erpService.DeleteSetting(c.Request.Context(), c.Param("key")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "删除设置", c.Param("key"), "")
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearSettings DELETE /settings — 清空全部设置。
func (h *ErpHandler) ClearSettings(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	if err := h.erpService.ClearSettings(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "清空设置", "全部", "")
	response.SuccessWithMessage(c, "已清空设置", nil)
}

// ExportAll GET /data/export — 导出全库备份。
func (h *ErpHandler) ExportAll(c *gin.Context) {
	if !requireExport(c) {
		return
	}
	data, err := h.erpService.ExportAll(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "备份导出", "全库", "")
	c.Header("Content-Disposition", "attachment; filename=erp-backup.json")
	c.JSON(http.StatusOK, response.Body{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

// ImportAll POST /data/import — 导入全库（先清空再写入）。
func (h *ErpHandler) ImportAll(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	var data model.ExportData
	if err := c.ShouldBindJSON(&data); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.erpService.ImportAll(c.Request.Context(), &data); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "恢复导入", "全库", "")
	response.SuccessWithMessage(c, "导入成功", nil)
}
