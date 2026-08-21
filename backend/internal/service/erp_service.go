package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"erp/internal/model"
	"erp/internal/repository"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ErpService ERP 存储业务层，对应前端 services/db.ts。
type ErpService interface {
	ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error)
	GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error)
	SaveChartAccount(ctx context.Context, account *model.ChartAccount) (*model.ChartAccount, error)
	DeleteChartAccount(ctx context.Context, id string) error
	ClearChartAccounts(ctx context.Context) error

	ListVouchers(ctx context.Context) ([]model.Voucher, error)
	GetVoucher(ctx context.Context, id string) (*model.Voucher, error)
	SaveVoucher(ctx context.Context, voucher *model.Voucher) (*model.Voucher, error)
	DeleteVoucher(ctx context.Context, id string) error
	ClearVouchers(ctx context.Context) error

	ListAttachments(ctx context.Context) ([]model.Attachment, error)
	GetAttachment(ctx context.Context, id string) (*model.Attachment, error)
	SaveAttachment(ctx context.Context, attachment *model.Attachment) (*model.Attachment, error)
	DeleteAttachment(ctx context.Context, id string) error
	ClearAttachments(ctx context.Context) error

	ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error)
	GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error)
	AddAuditLog(ctx context.Context, action, target, details, userAgent string) (*model.AuditLog, error)
	ClearAuditLogs(ctx context.Context) error

	ListSettings(ctx context.Context) ([]model.Setting, error)
	GetSetting(ctx context.Context, key string) (json.RawMessage, error)
	SetSetting(ctx context.Context, key string, value json.RawMessage) (*model.Setting, error)
	DeleteSetting(ctx context.Context, key string) error
	ClearSettings(ctx context.Context) error

	ExportAll(ctx context.Context) (*model.ExportData, error)
	ImportAll(ctx context.Context, data *model.ExportData) error
}

type erpService struct {
	repo repository.ErpRepository
}

func NewErpService(repo repository.ErpRepository) ErpService {
	return &erpService{repo: repo}
}

func generateID() string {
	buf := make([]byte, 4)
	_, _ = rand.Read(buf)
	return fmt.Sprintf("%x%s", time.Now().UnixNano()/1e6, hex.EncodeToString(buf))
}

func (s *erpService) ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error) {
	return s.repo.ListChartAccounts(ctx)
}

func (s *erpService) GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error) {
	item, err := s.repo.GetChartAccount(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("科目不存在")
		}
		return nil, err
	}
	return item, nil
}

func (s *erpService) SaveChartAccount(ctx context.Context, account *model.ChartAccount) (*model.ChartAccount, error) {
	if account.ID == "" {
		return nil, errors.New("科目 ID 不能为空")
	}
	if err := s.repo.SaveChartAccount(ctx, account); err != nil {
		return nil, err
	}
	return account, nil
}

func (s *erpService) DeleteChartAccount(ctx context.Context, id string) error {
	return s.repo.DeleteChartAccount(ctx, id)
}

func (s *erpService) ClearChartAccounts(ctx context.Context) error {
	return s.repo.ClearChartAccounts(ctx)
}

func (s *erpService) ListVouchers(ctx context.Context) ([]model.Voucher, error) {
	return s.repo.ListVouchers(ctx)
}

func (s *erpService) GetVoucher(ctx context.Context, id string) (*model.Voucher, error) {
	item, err := s.repo.GetVoucher(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("凭证不存在")
		}
		return nil, err
	}
	return item, nil
}

func (s *erpService) SaveVoucher(ctx context.Context, voucher *model.Voucher) (*model.Voucher, error) {
	if voucher.ID == "" {
		return nil, errors.New("凭证 ID 不能为空")
	}
	if len(voucher.Entries) == 0 {
		voucher.Entries = datatypes.JSON("[]")
	}
	if err := s.repo.SaveVoucher(ctx, voucher); err != nil {
		return nil, err
	}
	return voucher, nil
}

func (s *erpService) DeleteVoucher(ctx context.Context, id string) error {
	return s.repo.DeleteVoucher(ctx, id)
}

func (s *erpService) ClearVouchers(ctx context.Context) error {
	return s.repo.ClearVouchers(ctx)
}

func (s *erpService) ListAttachments(ctx context.Context) ([]model.Attachment, error) {
	return s.repo.ListAttachments(ctx)
}

func (s *erpService) GetAttachment(ctx context.Context, id string) (*model.Attachment, error) {
	item, err := s.repo.GetAttachment(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("附件不存在")
		}
		return nil, err
	}
	return item, nil
}

func (s *erpService) SaveAttachment(ctx context.Context, attachment *model.Attachment) (*model.Attachment, error) {
	if attachment.ID == "" {
		return nil, errors.New("附件 ID 不能为空")
	}
	if err := s.repo.SaveAttachment(ctx, attachment); err != nil {
		return nil, err
	}
	return attachment, nil
}

func (s *erpService) DeleteAttachment(ctx context.Context, id string) error {
	return s.repo.DeleteAttachment(ctx, id)
}

func (s *erpService) ClearAttachments(ctx context.Context) error {
	return s.repo.ClearAttachments(ctx)
}

func (s *erpService) ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error) {
	return s.repo.ListAuditLogs(ctx, limit)
}

func (s *erpService) GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error) {
	item, err := s.repo.GetAuditLog(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("审计日志不存在")
		}
		return nil, err
	}
	return item, nil
}

func (s *erpService) AddAuditLog(ctx context.Context, action, target, details, userAgent string) (*model.AuditLog, error) {
	if userAgent != "" && len(userAgent) > 100 {
		userAgent = userAgent[:100]
	}
	log := &model.AuditLog{
		ID:        generateID(),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action:    action,
		Target:    target,
		Details:   details,
		UserAgent: userAgent,
	}
	if err := s.repo.SaveAuditLog(ctx, log); err != nil {
		return nil, err
	}
	return log, nil
}

func (s *erpService) ClearAuditLogs(ctx context.Context) error {
	return s.repo.ClearAuditLogs(ctx)
}

func (s *erpService) ListSettings(ctx context.Context) ([]model.Setting, error) {
	return s.repo.ListSettings(ctx)
}

func (s *erpService) GetSetting(ctx context.Context, key string) (json.RawMessage, error) {
	item, err := s.repo.GetSetting(ctx, key)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return json.RawMessage(item.Value), nil
}

func (s *erpService) SetSetting(ctx context.Context, key string, value json.RawMessage) (*model.Setting, error) {
	if key == "" {
		return nil, errors.New("设置 key 不能为空")
	}
	if value == nil {
		value = json.RawMessage("null")
	}
	setting := &model.Setting{
		Key:   key,
		Value: datatypes.JSON(value),
	}
	if err := s.repo.SaveSetting(ctx, setting); err != nil {
		return nil, err
	}
	return setting, nil
}

func (s *erpService) DeleteSetting(ctx context.Context, key string) error {
	return s.repo.DeleteSetting(ctx, key)
}

func (s *erpService) ClearSettings(ctx context.Context) error {
	return s.repo.ClearSettings(ctx)
}

func (s *erpService) ExportAll(ctx context.Context) (*model.ExportData, error) {
	vouchers, err := s.repo.ListVouchers(ctx)
	if err != nil {
		return nil, err
	}
	accounts, err := s.repo.ListChartAccounts(ctx)
	if err != nil {
		return nil, err
	}
	auditLogs, err := s.repo.ListAuditLogs(ctx, 0)
	if err != nil {
		return nil, err
	}
	settings, err := s.repo.ListSettings(ctx)
	if err != nil {
		return nil, err
	}
	attachments, err := s.repo.ListAttachments(ctx)
	if err != nil {
		return nil, err
	}

	return &model.ExportData{
		Version:     1,
		ExportedAt:  time.Now().UTC().Format(time.RFC3339),
		Vouchers:    vouchers,
		Accounts:    accounts,
		AuditLogs:   auditLogs,
		Settings:    settings,
		Attachments: attachments,
	}, nil
}

func (s *erpService) ImportAll(ctx context.Context, data *model.ExportData) error {
	if data == nil {
		return errors.New("导入数据不能为空")
	}
	return s.repo.ImportAll(ctx, data)
}
