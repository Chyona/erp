package repository

import (
	"context"

	"erp/internal/model"
	"gorm.io/gorm"
)

// ErpRepository ERP 数据存储访问，对应前端 IndexedDB 五个 object store。
type ErpRepository interface {
	ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error)
	GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error)
	SaveChartAccount(ctx context.Context, account *model.ChartAccount) error
	DeleteChartAccount(ctx context.Context, id string) error
	ClearChartAccounts(ctx context.Context) error

	ListVouchers(ctx context.Context) ([]model.Voucher, error)
	GetVoucher(ctx context.Context, id string) (*model.Voucher, error)
	SaveVoucher(ctx context.Context, voucher *model.Voucher) error
	DeleteVoucher(ctx context.Context, id string) error
	ClearVouchers(ctx context.Context) error

	ListAttachments(ctx context.Context) ([]model.Attachment, error)
	GetAttachment(ctx context.Context, id string) (*model.Attachment, error)
	SaveAttachment(ctx context.Context, attachment *model.Attachment) error
	DeleteAttachment(ctx context.Context, id string) error
	ClearAttachments(ctx context.Context) error

	ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error)
	GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error)
	SaveAuditLog(ctx context.Context, log *model.AuditLog) error
	ClearAuditLogs(ctx context.Context) error

	ListSettings(ctx context.Context) ([]model.Setting, error)
	GetSetting(ctx context.Context, key string) (*model.Setting, error)
	SaveSetting(ctx context.Context, setting *model.Setting) error
	DeleteSetting(ctx context.Context, key string) error
	ClearSettings(ctx context.Context) error

	ImportAll(ctx context.Context, data *model.ExportData) error
}

type erpRepository struct {
	db *gorm.DB
}

func NewErpRepository(db *gorm.DB) ErpRepository {
	return &erpRepository{db: db}
}

func (r *erpRepository) ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error) {
	var items []model.ChartAccount
	err := r.db.WithContext(ctx).Order("code ASC").Find(&items).Error
	return items, err
}

func (r *erpRepository) GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error) {
	var item model.ChartAccount
	err := r.db.WithContext(ctx).First(&item, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *erpRepository) SaveChartAccount(ctx context.Context, account *model.ChartAccount) error {
	return r.db.WithContext(ctx).Save(account).Error
}

func (r *erpRepository) DeleteChartAccount(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&model.ChartAccount{}, "id = ?", id).Error
}

func (r *erpRepository) ClearChartAccounts(ctx context.Context) error {
	return r.db.WithContext(ctx).Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.ChartAccount{}).Error
}

func (r *erpRepository) ListVouchers(ctx context.Context) ([]model.Voucher, error) {
	var items []model.Voucher
	err := r.db.WithContext(ctx).Order("date ASC, voucher_no ASC").Find(&items).Error
	return items, err
}

func (r *erpRepository) GetVoucher(ctx context.Context, id string) (*model.Voucher, error) {
	var item model.Voucher
	err := r.db.WithContext(ctx).First(&item, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *erpRepository) SaveVoucher(ctx context.Context, voucher *model.Voucher) error {
	return r.db.WithContext(ctx).Save(voucher).Error
}

func (r *erpRepository) DeleteVoucher(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&model.Voucher{}, "id = ?", id).Error
}

func (r *erpRepository) ClearVouchers(ctx context.Context) error {
	return r.db.WithContext(ctx).Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Voucher{}).Error
}

func (r *erpRepository) ListAttachments(ctx context.Context) ([]model.Attachment, error) {
	var items []model.Attachment
	err := r.db.WithContext(ctx).Order("uploaded_at ASC").Find(&items).Error
	return items, err
}

func (r *erpRepository) GetAttachment(ctx context.Context, id string) (*model.Attachment, error) {
	var item model.Attachment
	err := r.db.WithContext(ctx).First(&item, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *erpRepository) SaveAttachment(ctx context.Context, attachment *model.Attachment) error {
	return r.db.WithContext(ctx).Save(attachment).Error
}

func (r *erpRepository) DeleteAttachment(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&model.Attachment{}, "id = ?", id).Error
}

func (r *erpRepository) ClearAttachments(ctx context.Context) error {
	return r.db.WithContext(ctx).Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Attachment{}).Error
}

func (r *erpRepository) ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error) {
	var items []model.AuditLog
	query := r.db.WithContext(ctx).Order("timestamp DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&items).Error
	return items, err
}

func (r *erpRepository) GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error) {
	var item model.AuditLog
	err := r.db.WithContext(ctx).First(&item, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *erpRepository) SaveAuditLog(ctx context.Context, log *model.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *erpRepository) ClearAuditLogs(ctx context.Context) error {
	return r.db.WithContext(ctx).Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.AuditLog{}).Error
}

func (r *erpRepository) ListSettings(ctx context.Context) ([]model.Setting, error) {
	var items []model.Setting
	err := r.db.WithContext(ctx).Order("key ASC").Find(&items).Error
	return items, err
}

func (r *erpRepository) GetSetting(ctx context.Context, key string) (*model.Setting, error) {
	var item model.Setting
	err := r.db.WithContext(ctx).First(&item, "key = ?", key).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *erpRepository) SaveSetting(ctx context.Context, setting *model.Setting) error {
	return r.db.WithContext(ctx).Save(setting).Error
}

func (r *erpRepository) DeleteSetting(ctx context.Context, key string) error {
	return r.db.WithContext(ctx).Delete(&model.Setting{}, "key = ?", key).Error
}

func (r *erpRepository) ClearSettings(ctx context.Context) error {
	return r.db.WithContext(ctx).Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Setting{}).Error
}

func (r *erpRepository) ImportAll(ctx context.Context, data *model.ExportData) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		repo := &erpRepository{db: tx}
		if err := repo.ClearVouchers(ctx); err != nil {
			return err
		}
		if err := repo.ClearChartAccounts(ctx); err != nil {
			return err
		}
		if err := repo.ClearAuditLogs(ctx); err != nil {
			return err
		}
		if err := repo.ClearSettings(ctx); err != nil {
			return err
		}
		if err := repo.ClearAttachments(ctx); err != nil {
			return err
		}

		if len(data.Vouchers) > 0 {
			if err := tx.Create(&data.Vouchers).Error; err != nil {
				return err
			}
		}
		if len(data.Accounts) > 0 {
			if err := tx.Create(&data.Accounts).Error; err != nil {
				return err
			}
		}
		if len(data.AuditLogs) > 0 {
			if err := tx.Create(&data.AuditLogs).Error; err != nil {
				return err
			}
		}
		if len(data.Settings) > 0 {
			if err := tx.Create(&data.Settings).Error; err != nil {
				return err
			}
		}
		if len(data.Attachments) > 0 {
			if err := tx.Create(&data.Attachments).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
