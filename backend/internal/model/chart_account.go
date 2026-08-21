package model

// ChartAccount 会计科目，对应前端 IndexedDB accounts 存储。
type ChartAccount struct {
	ID        string `gorm:"primaryKey;size:64" json:"id"`
	Code      string `gorm:"size:32;index;not null" json:"code"`
	Name      string `gorm:"size:128;not null" json:"name"`
	Category  string `gorm:"size:32;not null" json:"category"`
	Direction string `gorm:"size:16;not null" json:"direction"`
	CreatedAt string `gorm:"size:32" json:"createdAt,omitempty"`
	UpdatedAt string `gorm:"size:32" json:"updatedAt,omitempty"`
}

func (ChartAccount) TableName() string {
	return "chart_accounts"
}
