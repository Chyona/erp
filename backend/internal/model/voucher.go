package model

import "gorm.io/datatypes"

// Voucher 会计凭证，对应前端 vouchers store（表 vouchers）。
type Voucher struct {
	ID                         string         `gorm:"primaryKey;size:64" json:"id"`
	VoucherType                string         `gorm:"size:16" json:"voucherType"`
	VoucherNumber              string         `gorm:"size:32;index" json:"voucherNumber"`
	VoucherNo                  string         `gorm:"size:64;index" json:"voucherNo"`
	Date                       string         `gorm:"size:16;index" json:"date"`
	Entries                    datatypes.JSON `gorm:"type:jsonb;not null" json:"entries"`
	BusinessType               string         `gorm:"size:64" json:"businessType,omitempty"`
	InvoiceType                string         `gorm:"size:32" json:"invoiceType,omitempty"`
	TaxAmount                  *float64       `json:"taxAmount,omitempty"`
	InvoiceNumbers             string         `gorm:"size:512" json:"invoiceNumbers,omitempty"`
	Remark                     string         `gorm:"type:text" json:"remark,omitempty"`
	Status                     string         `gorm:"size:16;index" json:"status"`
	TotalDebit                 float64        `json:"totalDebit"`
	TotalCredit                float64        `json:"totalCredit"`
	Checksum                   string         `gorm:"size:128" json:"checksum,omitempty"`
	AttachmentIds              datatypes.JSON `gorm:"type:jsonb" json:"attachmentIds,omitempty"`
	AttachmentCount            *int           `json:"attachmentCount,omitempty"`
	PreparedBy                 string         `gorm:"size:64" json:"preparedBy,omitempty"`
	ReviewedBy                 string         `gorm:"size:64" json:"reviewedBy,omitempty"`
	PostedBy                   string         `gorm:"size:64" json:"postedBy,omitempty"`
	CashierBy                  string         `gorm:"size:64" json:"cashierBy,omitempty"`
	CreatedByAccountID         uint           `gorm:"index;default:0" json:"createdByAccountId,omitempty"`
	ReversedFromId             string         `gorm:"size:64" json:"reversedFromId,omitempty"`
	ReversedFromNo             string         `gorm:"size:64" json:"reversedFromNo,omitempty"`
	IsTaxExemptionCarryForward *bool          `json:"isTaxExemptionCarryForward,omitempty"`
	TaxExemptionDone           *bool          `json:"taxExemptionDone,omitempty"`
	TaxExemptionVoucherId      string         `gorm:"size:64" json:"taxExemptionVoucherId,omitempty"`
	TaxExemptionPeriod         string         `gorm:"size:32" json:"taxExemptionPeriod,omitempty"`
	TaxExemptionPeriodType     string         `gorm:"size:16" json:"taxExemptionPeriodType,omitempty"`
	IsProfitLossClosing        *bool          `json:"isProfitLossClosing,omitempty"`
	ProfitLossClosingPeriod    string         `gorm:"size:32" json:"profitLossClosingPeriod,omitempty"`
	ProfitLossClosingPeriodType string        `gorm:"size:16" json:"profitLossClosingPeriodType,omitempty"`
	CreatedAt                  string         `gorm:"size:32" json:"createdAt,omitempty"`
	UpdatedAt                  string         `gorm:"size:32" json:"updatedAt,omitempty"`
	ApprovedAt                 string         `gorm:"size:32" json:"approvedAt,omitempty"`
	LockedAt                   string         `gorm:"size:32" json:"lockedAt,omitempty"`
	QuarterDeclaredKey         string         `gorm:"size:32" json:"quarterDeclaredKey,omitempty"`
	ImportedAt                 string         `gorm:"size:32" json:"importedAt,omitempty"`
	ImportSource               string         `gorm:"size:128" json:"importSource,omitempty"`
}

func (Voucher) TableName() string {
	return "vouchers"
}
