package v1

import (
	"encoding/json"
	"net/http"
	"strconv"

	"erp/internal/model"
	"erp/internal/pkg/response"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
)

// ErpHandler ERP 存储 HTTP 处理器，对应前端 services/db.ts 五个 store。
type ErpHandler struct {
	erpService service.ErpService
}

func NewErpHandler(erpService service.ErpService) *ErpHandler {
	return &ErpHandler{erpService: erpService}
}

type setSettingRequest struct {
	Value json.RawMessage `json:"value"`
}

type addAuditLogRequest struct {
	Action  string `json:"action" binding:"required"`
	Target  string `json:"target"`
	Details string `json:"details"`
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
	response.Success(c, saved)
}

// DeleteChartAccount DELETE /accounts/:id — 删除单条科目。
func (h *ErpHandler) DeleteChartAccount(c *gin.Context) {
	if err := h.erpService.DeleteChartAccount(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearChartAccounts DELETE /accounts — 清空全部科目。
func (h *ErpHandler) ClearChartAccounts(c *gin.Context) {
	if err := h.erpService.ClearChartAccounts(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空科目", nil)
}

// ListVouchers GET /vouchers — 列出全部凭证。
func (h *ErpHandler) ListVouchers(c *gin.Context) {
	items, err := h.erpService.ListVouchers(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
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
	if err := h.erpService.DeleteVoucher(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearVouchers DELETE /vouchers — 清空全部凭证。
func (h *ErpHandler) ClearVouchers(c *gin.Context) {
	if err := h.erpService.ClearVouchers(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
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

// GetAttachment GET /attachments/:id — 按 ID 查询附件。
func (h *ErpHandler) GetAttachment(c *gin.Context) {
	item, err := h.erpService.GetAttachment(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

// SaveAttachment PUT /attachments/:id — 新增或更新附件。
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
	var decoded interface{}
	_ = json.Unmarshal(saved.Value, &decoded)
	response.Success(c, gin.H{"key": saved.Key, "value": decoded})
}

// DeleteSetting DELETE /settings/:key — 删除单条设置。
func (h *ErpHandler) DeleteSetting(c *gin.Context) {
	if err := h.erpService.DeleteSetting(c.Request.Context(), c.Param("key")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

// ClearSettings DELETE /settings — 清空全部设置。
func (h *ErpHandler) ClearSettings(c *gin.Context) {
	if err := h.erpService.ClearSettings(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空设置", nil)
}

// ExportAll GET /data/export — 导出全库备份。
func (h *ErpHandler) ExportAll(c *gin.Context) {
	data, err := h.erpService.ExportAll(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	c.Header("Content-Disposition", "attachment; filename=erp-backup.json")
	c.JSON(http.StatusOK, response.Body{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

// ImportAll POST /data/import — 导入全库（先清空再写入）。
func (h *ErpHandler) ImportAll(c *gin.Context) {
	var data model.ExportData
	if err := c.ShouldBindJSON(&data); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.erpService.ImportAll(c.Request.Context(), &data); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "导入成功", nil)
}
