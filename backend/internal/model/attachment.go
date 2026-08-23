package model

// Attachment 凭证附件元数据（文件本体存对象存储，库内仅保存未签名 URL）。
type Attachment struct {
	ID                        string `gorm:"primaryKey;size:64" json:"id"`
	Name                      string `gorm:"size:256;not null" json:"name"`
	Type                      string `gorm:"size:128" json:"type"`
	Size                      int64  `json:"size"`
	URL                       string `gorm:"column:url;size:1024" json:"url"`
	UploadedAt                string `gorm:"size:32" json:"uploadedAt"`
	RecognizedInvoiceNumbers  string `gorm:"size:512" json:"recognizedInvoiceNumbers,omitempty"`
}

func (Attachment) TableName() string {
	return "attachments"
}
