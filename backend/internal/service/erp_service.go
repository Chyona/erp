package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"erp/internal/model"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/storage"
	"erp/internal/repository"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ErpService ERP 业务层，对应前端 ErpApi（services/erpApi.ts）。
type ErpService interface {
	ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error)
	GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error)
	SaveChartAccount(ctx context.Context, account *model.ChartAccount) (*model.ChartAccount, error)
	SaveChartAccountsBatch(ctx context.Context, accounts []model.ChartAccount) ([]model.ChartAccount, error)
	DeleteChartAccount(ctx context.Context, id string) error
	DeleteChartAccountsBatch(ctx context.Context, ids []string) error
	ClearChartAccounts(ctx context.Context) error

	ListVouchers(ctx context.Context) ([]model.Voucher, error)
	GetVoucher(ctx context.Context, id string) (*model.Voucher, error)
	SaveVoucher(ctx context.Context, voucher *model.Voucher) (*model.Voucher, error)
	SaveVouchersBatch(ctx context.Context, vouchers []model.Voucher) ([]model.Voucher, error)
	ApproveVouchersBatch(ctx context.Context, ids []string) (*VoucherBatchOpResult, error)
	UnapproveVouchersBatch(ctx context.Context, ids []string) (*VoucherBatchOpResult, error)
	DeleteVoucher(ctx context.Context, id string) error
	DeleteVouchersBatch(ctx context.Context, ids []string) (*VoucherBatchOpResult, error)
	ClearVouchers(ctx context.Context) error

	ListAttachments(ctx context.Context) ([]model.Attachment, error)
	GetAttachment(ctx context.Context, id string) (*model.Attachment, error)
	UploadAttachment(ctx context.Context, id, name, contentType, voucherDate string, r io.Reader, size int64) (*model.Attachment, error)
	SaveAttachment(ctx context.Context, attachment *model.Attachment) (*model.Attachment, error)
	SaveAttachmentsBatch(ctx context.Context, items []model.Attachment) ([]model.Attachment, error)
	DeleteAttachment(ctx context.Context, id string) error
	DeleteAttachmentsBatch(ctx context.Context, ids []string) error
	ClearAttachments(ctx context.Context) error

	ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error)
	GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error)
	AddAuditLog(ctx context.Context, action, target, details, userAgent string) (*model.AuditLog, error)
	ClearAuditLogs(ctx context.Context) error

	ListSettings(ctx context.Context) ([]model.Setting, error)
	GetSetting(ctx context.Context, key string) (json.RawMessage, error)
	SetSetting(ctx context.Context, key string, value json.RawMessage) (*model.Setting, error)
	SetSettingsBatch(ctx context.Context, items []SettingKV) ([]model.Setting, error)
	DeleteSetting(ctx context.Context, key string) error
	ClearSettings(ctx context.Context) error

	ExportAll(ctx context.Context) (*model.ExportData, error)
	ImportAll(ctx context.Context, data *model.ExportData) error
}

// VoucherBatchFailItem 批量操作中单条失败明细。
type VoucherBatchFailItem struct {
	ID        string `json:"id"`
	VoucherNo string `json:"voucherNo"`
	Message   string `json:"message"`
}

// VoucherBatchOpResult 凭证批量操作结果（审核 / 反审核 / 删除共用）。
type VoucherBatchOpResult struct {
	Action     string                 `json:"action,omitempty"`
	Approved   int                    `json:"approved,omitempty"`
	Unapproved int                    `json:"unapproved,omitempty"`
	Deleted    int                    `json:"deleted,omitempty"`
	Skipped    int                    `json:"skipped"`
	Failed     []VoucherBatchFailItem `json:"failed"`
}

// SettingKV 批量写入设置的键值对。
type SettingKV struct {
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

type erpService struct {
	repo  repository.ErpRepository
	store *storage.Client
}

func NewErpService(repo repository.ErpRepository, store *storage.Client) ErpService {
	return &erpService{repo: repo, store: store}
}

// generateID 生成业务主键（UUID v4）。
func generateID() string {
	return uuid.NewString()
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

// SaveChartAccountsBatch 批量 upsert 科目。
func (s *erpService) SaveChartAccountsBatch(ctx context.Context, accounts []model.ChartAccount) ([]model.ChartAccount, error) {
	if len(accounts) == 0 {
		return []model.ChartAccount{}, nil
	}
	for i := range accounts {
		if accounts[i].ID == "" {
			return nil, errors.New("科目 ID 不能为空")
		}
	}
	if err := s.repo.SaveChartAccountsBatch(ctx, accounts); err != nil {
		return nil, err
	}
	return accounts, nil
}

func (s *erpService) DeleteChartAccount(ctx context.Context, id string) error {
	return s.repo.DeleteChartAccount(ctx, id)
}

// DeleteChartAccountsBatch 批量删除科目。
func (s *erpService) DeleteChartAccountsBatch(ctx context.Context, ids []string) error {
	return s.repo.DeleteChartAccountsByIDs(ctx, uniqueIDs(ids))
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
	if err := s.applyVoucherWritePolicy(ctx, voucher); err != nil {
		return nil, err
	}
	if err := s.repo.SaveVoucher(ctx, voucher); err != nil {
		return nil, err
	}
	return voucher, nil
}

// SaveVouchersBatch 批量 upsert 凭证（单事务），用于导入、重编号、季度结项等。
func (s *erpService) SaveVouchersBatch(ctx context.Context, vouchers []model.Voucher) ([]model.Voucher, error) {
	if len(vouchers) == 0 {
		return []model.Voucher{}, nil
	}
	actor := rbac.ActorFrom(ctx)
	if actor != nil && !actor.IsAdmin() {
		// 普通用户仅允许批量保存「自己的草稿 / 新建归属自己」的凭证；导入/结转等走管理员。
		for i := range vouchers {
			if err := s.applyVoucherWritePolicy(ctx, &vouchers[i]); err != nil {
				return nil, err
			}
		}
	} else {
		for i := range vouchers {
			if vouchers[i].ID == "" {
				return nil, errors.New("凭证 ID 不能为空")
			}
			if len(vouchers[i].Entries) == 0 {
				vouchers[i].Entries = datatypes.JSON("[]")
			}
			if actor != nil && actor.IsAdmin() {
				existing, err := s.repo.GetVoucher(ctx, vouchers[i].ID)
				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						if vouchers[i].CreatedByAccountID == 0 {
							vouchers[i].CreatedByAccountID = actor.AccountID
						}
					} else {
						return nil, err
					}
				} else if vouchers[i].CreatedByAccountID == 0 {
					vouchers[i].CreatedByAccountID = existing.CreatedByAccountID
				}
			}
		}
	}
	if err := s.repo.SaveVouchersBatch(ctx, vouchers); err != nil {
		return nil, err
	}
	return vouchers, nil
}

func (s *erpService) applyVoucherWritePolicy(ctx context.Context, voucher *model.Voucher) error {
	if voucher.ID == "" {
		return errors.New("凭证 ID 不能为空")
	}
	if len(voucher.Entries) == 0 {
		voucher.Entries = datatypes.JSON("[]")
	}
	actor := rbac.ActorFrom(ctx)
	if actor == nil {
		return nil
	}
	existing, err := s.repo.GetVoucher(ctx, voucher.ID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if !actor.CanCreateVoucher() {
			return errors.New("无权新建凭证")
		}
		voucher.CreatedByAccountID = actor.AccountID
		if strings.TrimSpace(voucher.PreparedBy) == "" {
			voucher.PreparedBy = actor.DisplayName()
		}
		if voucher.Status == "approved" && strings.TrimSpace(voucher.ReviewedBy) == "" {
			voucher.ReviewedBy = actor.DisplayName()
		}
		return nil
	}
	if !actor.CanMutateVoucher(existing.CreatedByAccountID, existing.Status) {
		if existing.CreatedByAccountID == 0 {
			return errors.New("该凭证为历史数据、无归属人，仅管理员可修改")
		}
		if existing.CreatedByAccountID != actor.AccountID {
			return errors.New("无权修改他人的凭证")
		}
		return errors.New("无权修改该凭证（普通用户仅可修改自己的草稿）")
	}
	voucher.CreatedByAccountID = existing.CreatedByAccountID
	// 制单人一旦写入则保留创建时的姓名
	if strings.TrimSpace(existing.PreparedBy) != "" {
		voucher.PreparedBy = existing.PreparedBy
	} else if strings.TrimSpace(voucher.PreparedBy) == "" {
		voucher.PreparedBy = actor.DisplayName()
	}
	return nil
}

func boolPtrTrue(v *bool) bool {
	return v != nil && *v
}

func isCarryForwardVoucher(v *model.Voucher) bool {
	return boolPtrTrue(v.IsTaxExemptionCarryForward) || boolPtrTrue(v.IsProfitLossClosing)
}

// uniqueIDs 去重并保持首次出现顺序。
func uniqueIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// ApproveVouchersBatch 批量草稿→已审核（一次查询 + 一次批量保存）。
func (s *erpService) ApproveVouchersBatch(ctx context.Context, ids []string) (*VoucherBatchOpResult, error) {
	if actor := rbac.ActorFrom(ctx); actor != nil && !actor.CanApprove() {
		return nil, errors.New("无权审核凭证")
	}
	ids = uniqueIDs(ids)
	result := &VoucherBatchOpResult{Failed: []VoucherBatchFailItem{}}
	if len(ids) == 0 {
		return result, nil
	}

	items, err := s.repo.GetVouchersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]model.Voucher, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}

	now := time.Now().UTC().Format(time.RFC3339)
	reviewer := ""
	if actor := rbac.ActorFrom(ctx); actor != nil {
		reviewer = actor.DisplayName()
	}
	toSave := make([]model.Voucher, 0, len(ids))
	for _, id := range ids {
		item, ok := byID[id]
		if !ok {
			result.Skipped++
			continue
		}
		if item.Status != "draft" {
			result.Skipped++
			continue
		}
		item.Status = "approved"
		item.ApprovedAt = now
		item.UpdatedAt = now
		if reviewer != "" {
			item.ReviewedBy = reviewer
		}
		toSave = append(toSave, item)
	}
	if len(toSave) > 0 {
		if err := s.repo.SaveVouchersBatch(ctx, toSave); err != nil {
			return nil, err
		}
	}
	result.Approved = len(toSave)
	return result, nil
}

// UnapproveVouchersBatch 批量已审核→草稿；已结项/结转凭证记入 failed。
func (s *erpService) UnapproveVouchersBatch(ctx context.Context, ids []string) (*VoucherBatchOpResult, error) {
	if actor := rbac.ActorFrom(ctx); actor != nil && !actor.CanApprove() {
		return nil, errors.New("无权反审核凭证")
	}
	ids = uniqueIDs(ids)
	result := &VoucherBatchOpResult{Failed: []VoucherBatchFailItem{}}
	if len(ids) == 0 {
		return result, nil
	}

	items, err := s.repo.GetVouchersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]model.Voucher, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}

	now := time.Now().UTC().Format(time.RFC3339)
	toSave := make([]model.Voucher, 0, len(ids))
	for _, id := range ids {
		item, ok := byID[id]
		if !ok {
			result.Skipped++
			continue
		}
		if item.Status == "locked" {
			result.Failed = append(result.Failed, VoucherBatchFailItem{
				ID: id, VoucherNo: item.VoucherNo, Message: "已结项，不可反审核",
			})
			continue
		}
		if item.Status != "approved" {
			result.Skipped++
			continue
		}
		if isCarryForwardVoucher(&item) {
			result.Failed = append(result.Failed, VoucherBatchFailItem{
				ID: id, VoucherNo: item.VoucherNo, Message: "系统结转凭证不可反审核",
			})
			continue
		}
		item.Status = "draft"
		item.ApprovedAt = ""
		item.ReviewedBy = ""
		item.UpdatedAt = now
		toSave = append(toSave, item)
	}
	if len(toSave) > 0 {
		if err := s.repo.SaveVouchersBatch(ctx, toSave); err != nil {
			return nil, err
		}
	}
	result.Unapproved = len(toSave)
	return result, nil
}

func parseAttachmentIDs(raw datatypes.JSON) []string {
	if len(raw) == 0 {
		return nil
	}
	var ids []string
	if err := json.Unmarshal(raw, &ids); err != nil {
		return nil
	}
	return uniqueIDs(ids)
}

// DeleteVouchersBatch 批量删除凭证（附带删除关联附件）；已结项/结转凭证记入 failed。
func (s *erpService) DeleteVouchersBatch(ctx context.Context, ids []string) (*VoucherBatchOpResult, error) {
	ids = uniqueIDs(ids)
	result := &VoucherBatchOpResult{Failed: []VoucherBatchFailItem{}}
	if len(ids) == 0 {
		return result, nil
	}

	items, err := s.repo.GetVouchersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]model.Voucher, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}

	actor := rbac.ActorFrom(ctx)
	toDelete := make([]string, 0, len(ids))
	attachmentIDs := make([]string, 0)
	for _, id := range ids {
		item, ok := byID[id]
		if !ok {
			result.Skipped++
			continue
		}
		if actor != nil && !actor.CanMutateVoucher(item.CreatedByAccountID, item.Status) {
			result.Failed = append(result.Failed, VoucherBatchFailItem{
				ID: id, VoucherNo: item.VoucherNo, Message: "无权删除该凭证",
			})
			continue
		}
		if item.Status == "locked" {
			result.Failed = append(result.Failed, VoucherBatchFailItem{
				ID: id, VoucherNo: item.VoucherNo, Message: "已结项，不可删除",
			})
			continue
		}
		if isCarryForwardVoucher(&item) {
			result.Failed = append(result.Failed, VoucherBatchFailItem{
				ID: id, VoucherNo: item.VoucherNo, Message: "系统结转凭证不可删除",
			})
			continue
		}
		toDelete = append(toDelete, id)
		attachmentIDs = append(attachmentIDs, parseAttachmentIDs(item.AttachmentIds)...)
	}

	if len(attachmentIDs) > 0 {
		if err := s.DeleteAttachmentsBatch(ctx, uniqueIDs(attachmentIDs)); err != nil {
			return nil, err
		}
	}
	if len(toDelete) > 0 {
		if err := s.repo.DeleteVouchersByIDs(ctx, toDelete); err != nil {
			return nil, err
		}
	}
	result.Deleted = len(toDelete)
	return result, nil
}

func (s *erpService) DeleteVoucher(ctx context.Context, id string) error {
	result, err := s.DeleteVouchersBatch(ctx, []string{id})
	if err != nil {
		return err
	}
	if result.Deleted == 1 {
		return nil
	}
	if len(result.Failed) > 0 {
		return errors.New(result.Failed[0].Message)
	}
	return errors.New("凭证不存在或不可删除")
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

func normalizeAttachmentURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return raw
	}
	u.RawQuery = ""
	u.Fragment = ""
	return u.String()
}

func sanitizeAttachmentFileName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "\\", "_")
	if name == "" || name == "." || name == ".." {
		return "file"
	}
	return name
}

// parseVoucherYearMonth 从凭证日期解析年、月；无效时回退到当前 UTC 日期。
func parseVoucherYearMonth(voucherDate string) (year, month string) {
	raw := strings.TrimSpace(voucherDate)
	raw = strings.ReplaceAll(raw, "/", "-")
	if len(raw) >= 10 {
		raw = raw[:10]
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return t.Format("2006"), t.Format("01")
	}
	if t, err := time.Parse("2006-1-2", raw); err == nil {
		return t.Format("2006"), t.Format("01")
	}
	now := time.Now().UTC()
	return now.Format("2006"), now.Format("01")
}

// UploadAttachment 将文件上传到对象存储，并仅将未签名 URL 写入附件表。
// 对象键按凭证日期落在 attachments/YYYY/MM/ 下。
func (s *erpService) UploadAttachment(
	ctx context.Context,
	id, name, contentType, voucherDate string,
	r io.Reader,
	size int64,
) (*model.Attachment, error) {
	if s.store == nil {
		return nil, errors.New("未配置对象存储，无法上传附件")
	}
	if r == nil {
		return nil, errors.New("上传内容为空")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		id = generateID()
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name = "file"
	}
	safeName := sanitizeAttachmentFileName(name)
	ext := filepath.Ext(safeName)
	if ext == "" {
		ext = ".dat"
	}
	year, month := parseVoucherYearMonth(voucherDate)
	objectKey := storage.AttachmentObjectKey(year, month, id, ext)
	publicURL, err := s.store.UploadPublic(ctx, r, objectKey, size)
	if err != nil {
		return nil, fmt.Errorf("上传附件到对象存储失败: %w", err)
	}
	publicURL = normalizeAttachmentURL(publicURL)
	if publicURL == "" {
		return nil, errors.New("对象存储未返回有效 URL")
	}
	att := &model.Attachment{
		ID:         id,
		Name:       name,
		Type:       contentType,
		Size:       size,
		URL:        publicURL,
		UploadedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.SaveAttachment(ctx, att); err != nil {
		return nil, err
	}
	return att, nil
}

func (s *erpService) SaveAttachment(ctx context.Context, attachment *model.Attachment) (*model.Attachment, error) {
	if attachment.ID == "" {
		return nil, errors.New("附件 ID 不能为空")
	}
	attachment.URL = normalizeAttachmentURL(attachment.URL)
	if attachment.URL == "" {
		existing, err := s.repo.GetAttachment(ctx, attachment.ID)
		if err == nil && existing != nil {
			attachment.URL = normalizeAttachmentURL(existing.URL)
			if attachment.Size == 0 {
				attachment.Size = existing.Size
			}
			if attachment.Type == "" {
				attachment.Type = existing.Type
			}
			if attachment.UploadedAt == "" {
				attachment.UploadedAt = existing.UploadedAt
			}
		}
	}
	if attachment.URL == "" {
		return nil, errors.New("附件 URL 不能为空，请先上传文件")
	}
	if strings.HasPrefix(strings.ToLower(attachment.URL), "data:") {
		return nil, errors.New("不支持将文件内容写入数据库，请通过上传接口存到对象存储")
	}
	if err := s.repo.SaveAttachment(ctx, attachment); err != nil {
		return nil, err
	}
	return attachment, nil
}

// SaveAttachmentsBatch 批量 upsert 附件元数据（单事务；不含文件上传）。
func (s *erpService) SaveAttachmentsBatch(ctx context.Context, items []model.Attachment) ([]model.Attachment, error) {
	if len(items) == 0 {
		return []model.Attachment{}, nil
	}
	for i := range items {
		if items[i].ID == "" {
			return nil, errors.New("附件 ID 不能为空")
		}
		items[i].URL = normalizeAttachmentURL(items[i].URL)
		if items[i].URL == "" {
			return nil, fmt.Errorf("附件 %s URL 不能为空", items[i].ID)
		}
		if strings.HasPrefix(strings.ToLower(items[i].URL), "data:") {
			return nil, errors.New("不支持将文件内容写入数据库，请通过上传接口存到对象存储")
		}
	}
	if err := s.repo.SaveAttachmentsBatch(ctx, items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *erpService) deleteAttachmentObject(ctx context.Context, publicURL string) error {
	if s.store == nil {
		return nil
	}
	if err := s.store.DeleteByPublicURL(ctx, publicURL); err != nil {
		return fmt.Errorf("删除对象存储文件失败: %w", err)
	}
	return nil
}

func (s *erpService) deleteAttachmentObjects(ctx context.Context, items []model.Attachment) error {
	for i := range items {
		if err := s.deleteAttachmentObject(ctx, items[i].URL); err != nil {
			return err
		}
	}
	return nil
}

func (s *erpService) DeleteAttachment(ctx context.Context, id string) error {
	item, err := s.repo.GetAttachment(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if err := s.deleteAttachmentObject(ctx, item.URL); err != nil {
		return err
	}
	return s.repo.DeleteAttachment(ctx, id)
}

// DeleteAttachmentsBatch 批量删除附件（含对象存储文件）。
func (s *erpService) DeleteAttachmentsBatch(ctx context.Context, ids []string) error {
	ids = uniqueIDs(ids)
	if len(ids) == 0 {
		return nil
	}
	for _, id := range ids {
		item, err := s.repo.GetAttachment(ctx, id)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return err
		}
		if err := s.deleteAttachmentObject(ctx, item.URL); err != nil {
			return err
		}
	}
	return s.repo.DeleteAttachmentsByIDs(ctx, ids)
}

func (s *erpService) ClearAttachments(ctx context.Context) error {
	items, err := s.repo.ListAttachments(ctx)
	if err != nil {
		return err
	}
	if err := s.deleteAttachmentObjects(ctx, items); err != nil {
		return err
	}
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
	if actor := rbac.ActorFrom(ctx); actor != nil {
		log.OperatorAccountID = actor.AccountID
		log.OperatorUsername = actor.Username
		log.OperatorNickname = actor.Nickname
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

// SetSettingsBatch 批量写入设置（逐条保存，避免一次请求多次往返）。
func (s *erpService) SetSettingsBatch(ctx context.Context, items []SettingKV) ([]model.Setting, error) {
	if len(items) == 0 {
		return []model.Setting{}, nil
	}
	out := make([]model.Setting, 0, len(items))
	for _, item := range items {
		if item.Key == "" {
			return nil, errors.New("设置 key 不能为空")
		}
		value := item.Value
		if value == nil {
			value = json.RawMessage("null")
		}
		setting := model.Setting{Key: item.Key, Value: datatypes.JSON(value)}
		if err := s.repo.SaveSetting(ctx, &setting); err != nil {
			return nil, err
		}
		out = append(out, setting)
	}
	return out, nil
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
