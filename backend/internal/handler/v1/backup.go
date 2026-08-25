package v1

import (
	"io"
	"net/http"
	"strings"

	"erp/internal/middleware"
	"erp/internal/pkg/response"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
)

// BackupHandler 备份与恢复 HTTP 处理器。
type BackupHandler struct {
	backupService  service.BackupService
	erpService     service.ErpService
	accountService service.AccountService
}

func NewBackupHandler(backupService service.BackupService, erpService service.ErpService, accountService service.AccountService) *BackupHandler {
	return &BackupHandler{backupService: backupService, erpService: erpService, accountService: accountService}
}

func (h *BackupHandler) writeAudit(c *gin.Context, action, target, details string) {
	_, _ = h.erpService.AddAuditLog(c.Request.Context(), action, target, details, c.GetHeader("User-Agent"))
}

func requireBackupExport(c *gin.Context) bool {
	actor := middleware.GetActor(c)
	if actor == nil {
		response.Unauthorized(c, "请先登录")
		return false
	}
	if !actor.CanExport() {
		response.Forbidden(c, "当前账号无权备份")
		return false
	}
	return true
}

func requireBackupRestore(c *gin.Context) bool {
	actor := middleware.GetActor(c)
	if actor == nil {
		response.Unauthorized(c, "请先登录")
		return false
	}
	if !actor.IsAdmin() {
		response.Forbidden(c, "需要管理员权限")
		return false
	}
	return true
}

// ListBackups GET /backups
func (h *BackupHandler) ListBackups(c *gin.Context) {
	actor := middleware.GetActor(c)
	if actor != nil && !actor.CanExport() && !actor.IsAdmin() {
		response.Forbidden(c, "当前账号无权查看备份")
		return
	}
	items, err := h.backupService.List(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, items)
}

// CreateBackup POST /backups
func (h *BackupHandler) CreateBackup(c *gin.Context) {
	if !requireBackupExport(c) {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	_ = c.ShouldBindJSON(&body)
	data, err := h.erpService.ExportAll(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	record, err := h.backupService.Create(c.Request.Context(), body.Name, data)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "备份", record.Name, "手动备份")
	response.Success(c, record)
}

// UploadBackup POST /backups/upload
func (h *BackupHandler) UploadBackup(c *gin.Context) {
	if !requireBackupRestore(c) {
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "请上传备份文件")
		return
	}
	if file.Size > maxUploadBytes {
		response.BadRequest(c, "备份文件不能超过 20MB")
		return
	}
	f, err := file.Open()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	defer f.Close()
	content, err := io.ReadAll(f)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = strings.TrimSuffix(file.Filename, ".bak")
		name = strings.TrimSuffix(name, ".json")
	}
	record, err := h.backupService.Upload(c.Request.Context(), name, content)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	h.writeAudit(c, "备份上传", record.Name, "用户上传备份")
	response.Success(c, record)
}

// DownloadBackup GET /backups/:id/download
func (h *BackupHandler) DownloadBackup(c *gin.Context) {
	if !requireBackupExport(c) {
		return
	}
	id := c.Param("id")
	content, filename, err := h.backupService.Download(c.Request.Context(), id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "application/octet-stream", content)
}

// RenameBackup PUT /backups/:id
func (h *BackupHandler) RenameBackup(c *gin.Context) {
	if !requireBackupRestore(c) {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		response.BadRequest(c, "备份名称不能为空")
		return
	}
	record, err := h.backupService.Rename(c.Request.Context(), c.Param("id"), body.Name)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	h.writeAudit(c, "备份重命名", record.Name, "重命名备份")
	response.Success(c, record)
}

// DeleteBackup DELETE /backups/:id
func (h *BackupHandler) DeleteBackup(c *gin.Context) {
	if !requireBackupRestore(c) {
		return
	}
	id := c.Param("id")
	if err := h.backupService.Delete(c.Request.Context(), id); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	h.writeAudit(c, "备份删除", id, "删除备份")
	response.SuccessWithMessage(c, "删除成功", nil)
}

// BatchDeleteBackups POST /backups/batch-delete
func (h *BackupHandler) BatchDeleteBackups(c *gin.Context) {
	if !requireBackupRestore(c) {
		return
	}
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IDs) == 0 {
		response.BadRequest(c, "请选择要删除的备份")
		return
	}
	if err := h.backupService.BatchDelete(c.Request.Context(), body.IDs); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "备份删除", "批量", "删除备份")
	response.SuccessWithMessage(c, "删除成功", nil)
}

// RestoreBackup POST /backups/:id/restore
func (h *BackupHandler) RestoreBackup(c *gin.Context) {
	if !requireBackupRestore(c) {
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	password := strings.TrimSpace(body.Password)
	if password == "" {
		response.BadRequest(c, "恢复全库数据需输入当前登录密码")
		return
	}
	claims := middleware.GetAuthClaims(c)
	if claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	if err := h.accountService.VerifyPassword(c.Request.Context(), claims.AccountID, password); err != nil {
		response.Forbidden(c, "密码不正确")
		return
	}
	data, err := h.backupService.Read(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}
	if err := h.erpService.ImportAll(c.Request.Context(), data); err != nil {
		response.InternalError(c, err.Error())
		return
	}
	h.writeAudit(c, "恢复", "全库", "从服务端备份恢复")
	response.SuccessWithMessage(c, "恢复成功", nil)
}
