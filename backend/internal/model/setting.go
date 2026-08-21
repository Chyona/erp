package model

import "gorm.io/datatypes"

// Setting 系统设置，对应前端 settings store（表 settings；value 为 JSON）。
type Setting struct {
	Key   string         `gorm:"primaryKey;size:128" json:"key"`
	Value datatypes.JSON `gorm:"type:jsonb" json:"value"`
}

func (Setting) TableName() string {
	return "settings"
}

// ExportData 全量备份结构，对应前端 DB.exportAll / importAll。
type ExportData struct {
	Version    int             `json:"version"`
	ExportedAt string          `json:"exportedAt"`
	Vouchers   []Voucher       `json:"vouchers"`
	Accounts   []ChartAccount  `json:"accounts"`
	AuditLogs  []AuditLog      `json:"auditLogs"`
	Settings   []Setting       `json:"settings"`
	Attachments []Attachment   `json:"attachments"`
}
