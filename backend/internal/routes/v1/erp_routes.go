package v1

import (
	v1handler "erp/internal/handler/v1"
	"github.com/gin-gonic/gin"
)

// RegisterErpRoutes 注册 ERP 数据存储路由，对应前端 IndexedDB 五个 object store。
func RegisterErpRoutes(rg *gin.RouterGroup, erpHandler *v1handler.ErpHandler, appHandler *v1handler.AppHandler) {
	rg.POST("/app/init", appHandler.Init)

	accounts := rg.Group("/accounts")
	{
		accounts.GET("", erpHandler.ListChartAccounts)
		accounts.DELETE("", erpHandler.ClearChartAccounts)
		accounts.GET("/:id", erpHandler.GetChartAccount)
		accounts.PUT("/:id", erpHandler.SaveChartAccount)
		accounts.DELETE("/:id", erpHandler.DeleteChartAccount)
	}

	vouchers := rg.Group("/vouchers")
	{
		vouchers.GET("", erpHandler.ListVouchers)
		vouchers.DELETE("", erpHandler.ClearVouchers)
		vouchers.GET("/:id", erpHandler.GetVoucher)
		vouchers.PUT("/:id", erpHandler.SaveVoucher)
		vouchers.DELETE("/:id", erpHandler.DeleteVoucher)
	}

	attachments := rg.Group("/attachments")
	{
		attachments.GET("", erpHandler.ListAttachments)
		attachments.DELETE("", erpHandler.ClearAttachments)
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
