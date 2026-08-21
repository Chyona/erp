package service

import (
	"context"
	"sync"

	"erp/internal/model"
	"gorm.io/gorm"
)

// memoryErpRepo 内存版 ErpRepository，供单元测试使用。
type memoryErpRepo struct {
	mu          sync.Mutex
	accounts    map[string]model.ChartAccount
	vouchers    map[string]model.Voucher
	attachments map[string]model.Attachment
	auditLogs   map[string]model.AuditLog
	settings    map[string]model.Setting
}

func newMemoryErpRepo() *memoryErpRepo {
	return &memoryErpRepo{
		accounts:    map[string]model.ChartAccount{},
		vouchers:    map[string]model.Voucher{},
		attachments: map[string]model.Attachment{},
		auditLogs:   map[string]model.AuditLog{},
		settings:    map[string]model.Setting{},
	}
}

func (r *memoryErpRepo) ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := make([]model.ChartAccount, 0, len(r.accounts))
	for _, v := range r.accounts {
		items = append(items, v)
	}
	return items, nil
}

func (r *memoryErpRepo) GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.accounts[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	cp := item
	return &cp, nil
}

func (r *memoryErpRepo) SaveChartAccount(ctx context.Context, account *model.ChartAccount) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.accounts[account.ID] = *account
	return nil
}

func (r *memoryErpRepo) DeleteChartAccount(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.accounts, id)
	return nil
}

func (r *memoryErpRepo) ClearChartAccounts(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.accounts = map[string]model.ChartAccount{}
	return nil
}

func (r *memoryErpRepo) ListVouchers(ctx context.Context) ([]model.Voucher, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := make([]model.Voucher, 0, len(r.vouchers))
	for _, v := range r.vouchers {
		items = append(items, v)
	}
	return items, nil
}

func (r *memoryErpRepo) GetVoucher(ctx context.Context, id string) (*model.Voucher, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.vouchers[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	cp := item
	return &cp, nil
}

func (r *memoryErpRepo) SaveVoucher(ctx context.Context, voucher *model.Voucher) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.vouchers[voucher.ID] = *voucher
	return nil
}

func (r *memoryErpRepo) DeleteVoucher(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.vouchers, id)
	return nil
}

func (r *memoryErpRepo) ClearVouchers(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.vouchers = map[string]model.Voucher{}
	return nil
}

func (r *memoryErpRepo) ListAttachments(ctx context.Context) ([]model.Attachment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := make([]model.Attachment, 0, len(r.attachments))
	for _, v := range r.attachments {
		items = append(items, v)
	}
	return items, nil
}

func (r *memoryErpRepo) GetAttachment(ctx context.Context, id string) (*model.Attachment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.attachments[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	cp := item
	return &cp, nil
}

func (r *memoryErpRepo) SaveAttachment(ctx context.Context, attachment *model.Attachment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.attachments[attachment.ID] = *attachment
	return nil
}

func (r *memoryErpRepo) DeleteAttachment(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.attachments, id)
	return nil
}

func (r *memoryErpRepo) ClearAttachments(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.attachments = map[string]model.Attachment{}
	return nil
}

func (r *memoryErpRepo) ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := make([]model.AuditLog, 0, len(r.auditLogs))
	for _, v := range r.auditLogs {
		items = append(items, v)
	}
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

func (r *memoryErpRepo) GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.auditLogs[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	cp := item
	return &cp, nil
}

func (r *memoryErpRepo) SaveAuditLog(ctx context.Context, log *model.AuditLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.auditLogs[log.ID] = *log
	return nil
}

func (r *memoryErpRepo) ClearAuditLogs(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.auditLogs = map[string]model.AuditLog{}
	return nil
}

func (r *memoryErpRepo) ListSettings(ctx context.Context) ([]model.Setting, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := make([]model.Setting, 0, len(r.settings))
	for _, v := range r.settings {
		items = append(items, v)
	}
	return items, nil
}

func (r *memoryErpRepo) GetSetting(ctx context.Context, key string) (*model.Setting, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.settings[key]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	cp := item
	return &cp, nil
}

func (r *memoryErpRepo) SaveSetting(ctx context.Context, setting *model.Setting) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.settings[setting.Key] = *setting
	return nil
}

func (r *memoryErpRepo) DeleteSetting(ctx context.Context, key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.settings, key)
	return nil
}

func (r *memoryErpRepo) ClearSettings(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.settings = map[string]model.Setting{}
	return nil
}

func (r *memoryErpRepo) ImportAll(ctx context.Context, data *model.ExportData) error {
	_ = r.ClearVouchers(ctx)
	_ = r.ClearChartAccounts(ctx)
	_ = r.ClearAuditLogs(ctx)
	_ = r.ClearSettings(ctx)
	_ = r.ClearAttachments(ctx)
	for i := range data.Vouchers {
		_ = r.SaveVoucher(ctx, &data.Vouchers[i])
	}
	for i := range data.Accounts {
		_ = r.SaveChartAccount(ctx, &data.Accounts[i])
	}
	for i := range data.AuditLogs {
		_ = r.SaveAuditLog(ctx, &data.AuditLogs[i])
	}
	for i := range data.Settings {
		_ = r.SaveSetting(ctx, &data.Settings[i])
	}
	for i := range data.Attachments {
		_ = r.SaveAttachment(ctx, &data.Attachments[i])
	}
	return nil
}
