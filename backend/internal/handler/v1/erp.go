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

// ErpHandler ERP 存储 HTTP 处理器，对应前端 IndexedDB 五个 store。
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

func (h *ErpHandler) ListChartAccounts(c *gin.Context) {
	items, err := h.erpService.ListChartAccounts(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *ErpHandler) GetChartAccount(c *gin.Context) {
	item, err := h.erpService.GetChartAccount(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

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

func (h *ErpHandler) DeleteChartAccount(c *gin.Context) {
	if err := h.erpService.DeleteChartAccount(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *ErpHandler) ClearChartAccounts(c *gin.Context) {
	if err := h.erpService.ClearChartAccounts(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空科目", nil)
}

func (h *ErpHandler) ListVouchers(c *gin.Context) {
	items, err := h.erpService.ListVouchers(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *ErpHandler) GetVoucher(c *gin.Context) {
	item, err := h.erpService.GetVoucher(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

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

func (h *ErpHandler) DeleteVoucher(c *gin.Context) {
	if err := h.erpService.DeleteVoucher(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *ErpHandler) ClearVouchers(c *gin.Context) {
	if err := h.erpService.ClearVouchers(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空凭证", nil)
}

func (h *ErpHandler) ListAttachments(c *gin.Context) {
	items, err := h.erpService.ListAttachments(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *ErpHandler) GetAttachment(c *gin.Context) {
	item, err := h.erpService.GetAttachment(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

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

func (h *ErpHandler) DeleteAttachment(c *gin.Context) {
	if err := h.erpService.DeleteAttachment(c.Request.Context(), c.Param("id")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *ErpHandler) ClearAttachments(c *gin.Context) {
	if err := h.erpService.ClearAttachments(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空附件", nil)
}

func (h *ErpHandler) ListAuditLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))
	items, err := h.erpService.ListAuditLogs(c.Request.Context(), limit)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *ErpHandler) GetAuditLog(c *gin.Context) {
	item, err := h.erpService.GetAuditLog(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.Success(c, item)
}

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

func (h *ErpHandler) ClearAuditLogs(c *gin.Context) {
	if err := h.erpService.ClearAuditLogs(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空审计日志", nil)
}

func (h *ErpHandler) ListSettings(c *gin.Context) {
	items, err := h.erpService.ListSettings(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

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

func (h *ErpHandler) DeleteSetting(c *gin.Context) {
	if err := h.erpService.DeleteSetting(c.Request.Context(), c.Param("key")); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "删除成功", nil)
}

func (h *ErpHandler) ClearSettings(c *gin.Context) {
	if err := h.erpService.ClearSettings(c.Request.Context()); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.SuccessWithMessage(c, "已清空设置", nil)
}

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
