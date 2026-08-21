package model

// Attachment 凭证附件，对应前端 attachments store（表 attachments；data 存 base64）。
type Attachment struct {
	ID         string `gorm:"primaryKey;size:64" json:"id"`
	Name       string `gorm:"size:256;not null" json:"name"`
	Type       string `gorm:"size:128" json:"type"`
	Size       int64  `json:"size"`
	Data       string `gorm:"type:text" json:"data"`
	UploadedAt string `gorm:"size:32" json:"uploadedAt"`
}

func (Attachment) TableName() string {
	return "attachments"
}
