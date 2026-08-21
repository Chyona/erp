package v1

import (
	v1handler "erp/internal/handler/v1"
	"github.com/gin-gonic/gin"
)

// RegisterErpRoutes 注册 ERP 数据存储路由（/openapi/erp/v1）。
// 统一批量入口（须注册在 /:id 之前）：
//   POST /{store}/batch  { action, ids?|items? }  — 数组长度 1 即单条
func RegisterErpRoutes(rg *gin.RouterGroup, erpHandler *v1handler.ErpHandler, appHandler *v1handler.AppHandler, importHandler *v1handler.ImportHandler) {
	rg.POST("/app/init", appHandler.Init)

	accounts := rg.Group("/accounts")
	{
		accounts.GET("", erpHandler.ListChartAccounts)
		accounts.DELETE("", erpHandler.ClearChartAccounts)
		accounts.POST("/batch", erpHandler.SaveChartAccountsBatch)
		accounts.PUT("/batch", erpHandler.SaveChartAccountsBatch) // 兼容：body 需带 action
		accounts.DELETE("/batch", erpHandler.DeleteChartAccountsBatch)
		accounts.GET("/:id", erpHandler.GetChartAccount)
		accounts.PUT("/:id", erpHandler.SaveChartAccount)
		accounts.DELETE("/:id", erpHandler.DeleteChartAccount)
	}

	vouchers := rg.Group("/vouchers")
	{
		vouchers.GET("", erpHandler.ListVouchers)
		vouchers.DELETE("", erpHandler.ClearVouchers)
		vouchers.POST("/batch", erpHandler.VouchersBatch)
		// 兼容旧调用
		vouchers.PUT("/batch", erpHandler.SaveVouchersBatch)
		vouchers.DELETE("/batch", erpHandler.DeleteVouchersBatch)
		vouchers.POST("/batch-approve", erpHandler.ApproveVouchersBatch)
		vouchers.POST("/batch-unapprove", erpHandler.UnapproveVouchersBatch)
		if importHandler != nil {
			vouchers.GET("/import-llm-status", importHandler.LLMStatus)
			vouchers.POST("/parse-import-image", importHandler.ParseImportImage)
		}
		vouchers.GET("/:id", erpHandler.GetVoucher)
		vouchers.PUT("/:id", erpHandler.SaveVoucher)
		vouchers.DELETE("/:id", erpHandler.DeleteVoucher)
	}

	attachments := rg.Group("/attachments")
	{
		attachments.GET("", erpHandler.ListAttachments)
		attachments.DELETE("", erpHandler.ClearAttachments)
		attachments.POST("/batch", erpHandler.AttachmentsBatch)
		attachments.PUT("/batch", erpHandler.AttachmentsBatch)
		attachments.DELETE("/batch", erpHandler.DeleteAttachmentsBatch)
		attachments.GET("/:id", erpHandler.GetAttachment)
		attachments.PUT("/:id", erpHandler.SaveAttachment)
		attachments.DELETE("/:id", erpHandler.DeleteAttachment)
	}

	auditLogs := rg.Group("/audit-logs")
	{
		auditLogs.GET("", erpHandler.ListAuditLogs)
		auditLogs.POST("", erpHandler.AddAuditLog)
		auditLogs.DELETE("", erpHandler.ClearAuditLogs)
		auditLogs.GET("/:id", erpHandler.GetAuditLog)
	}

	settings := rg.Group("/settings")
	{
		settings.GET("", erpHandler.ListSettings)
		settings.DELETE("", erpHandler.ClearSettings)
		settings.PUT("/batch", erpHandler.SetSettingsBatch)
		settings.GET("/:key", erpHandler.GetSetting)
		settings.PUT("/:key", erpHandler.SetSetting)
		settings.DELETE("/:key", erpHandler.DeleteSetting)
	}

	data := rg.Group("/data")
	{
		data.GET("/export", erpHandler.ExportAll)
		data.POST("/import", erpHandler.ImportAll)
	}
}
