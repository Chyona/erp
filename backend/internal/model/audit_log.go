package model

// AuditLog 审计日志，对应前端 auditLogs store（表 audit_logs）。
type AuditLog struct {
	ID                 string `gorm:"primaryKey;size:64" json:"id"`
	Timestamp          string `gorm:"size:32;index" json:"timestamp"`
	Action             string `gorm:"size:64;not null" json:"action"`
	Target             string `gorm:"size:128" json:"target"`
	Details            string `gorm:"type:text" json:"details"`
	UserAgent          string `gorm:"size:256" json:"userAgent"`
	OperatorAccountID  uint   `gorm:"index;column:operator_account_id" json:"operatorAccountId"`
	OperatorUsername   string `gorm:"size:64;index" json:"operatorUsername"`
	OperatorNickname   string `gorm:"size:64" json:"operatorNickname"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
