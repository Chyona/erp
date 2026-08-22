package service

import (
	"context"
	"encoding/json"
	"testing"

	"erp/internal/model"
	"gorm.io/datatypes"
)

// TestErpService_ChartAccounts 覆盖科目增删改查与清空。
func TestErpService_ChartAccounts(t *testing.T) {
	svc := NewErpService(newMemoryErpRepo(), nil)
	ctx := context.Background()

	_, err := svc.GetChartAccount(ctx, "missing")
	if err == nil || err.Error() != "科目不存在" {
		t.Fatalf("GetChartAccount missing = %v, want 科目不存在", err)
	}

	_, err = svc.SaveChartAccount(ctx, &model.ChartAccount{Code: "1002", Name: "银行存款"})
	if err == nil {
		t.Fatal("SaveChartAccount empty id should fail")
	}

	saved, err := svc.SaveChartAccount(ctx, &model.ChartAccount{
		ID: "acc1", Code: "1002", Name: "银行存款", Category: "资产", Direction: "debit",
	})
	if err != nil {
		t.Fatalf("SaveChartAccount() error = %v", err)
	}
	if saved.ID != "acc1" {
		t.Fatalf("saved.ID = %q", saved.ID)
	}

	got, err := svc.GetChartAccount(ctx, "acc1")
	if err != nil {
		t.Fatalf("GetChartAccount() error = %v", err)
	}
	if got.Name != "银行存款" {
		t.Fatalf("got.Name = %q", got.Name)
	}

	list, err := svc.ListChartAccounts(ctx)
	if err != nil || len(list) != 1 {
		t.Fatalf("ListChartAccounts() = %v, %v", list, err)
	}

	if err := svc.DeleteChartAccount(ctx, "acc1"); err != nil {
		t.Fatalf("DeleteChartAccount() error = %v", err)
	}
	if err := svc.ClearChartAccounts(ctx); err != nil {
		t.Fatalf("ClearChartAccounts() error = %v", err)
	}
}

// TestErpService_Vouchers 覆盖凭证保存、空分录默认与删除。
func TestErpService_Vouchers(t *testing.T) {
	svc := NewErpService(newMemoryErpRepo(), nil)
	ctx := context.Background()

	_, err := svc.GetVoucher(ctx, "missing")
	if err == nil || err.Error() != "凭证不存在" {
		t.Fatalf("GetVoucher missing = %v", err)
	}

	_, err = svc.SaveVoucher(ctx, &model.Voucher{})
	if err == nil {
		t.Fatal("SaveVoucher empty id should fail")
	}

	saved, err := svc.SaveVoucher(ctx, &model.Voucher{
		ID: "v1", VoucherNo: "记-1", Date: "2026-01-01", Status: "draft",
	})
	if err != nil {
		t.Fatalf("SaveVoucher() error = %v", err)
	}
	if string(saved.Entries) != "[]" {
		t.Fatalf("empty entries should default to [], got %s", saved.Entries)
	}

	got, err := svc.GetVoucher(ctx, "v1")
	if err != nil || got.VoucherNo != "记-1" {
		t.Fatalf("GetVoucher() = %+v, %v", got, err)
	}

	list, err := svc.ListVouchers(ctx)
	if err != nil || len(list) != 1 {
		t.Fatalf("ListVouchers() = %v, %v", list, err)
	}

	if err := svc.DeleteVoucher(ctx, "v1"); err != nil {
		t.Fatalf("DeleteVoucher() error = %v", err)
	}
	if err := svc.ClearVouchers(ctx); err != nil {
		t.Fatalf("ClearVouchers() error = %v", err)
	}
}

// TestErpService_VoucherBatch 覆盖批量 upsert / 审核 / 反审核。
func TestErpService_VoucherBatch(t *testing.T) {
	svc := NewErpService(newMemoryErpRepo(), nil)
	ctx := context.Background()

	carry := true
	_, err := svc.SaveVouchersBatch(ctx, []model.Voucher{
		{ID: "d1", VoucherNo: "记-1", Date: "2026-01-01", Status: "draft"},
		{ID: "d2", VoucherNo: "记-2", Date: "2026-01-02", Status: "draft"},
		{ID: "a1", VoucherNo: "记-3", Date: "2026-01-03", Status: "approved", ApprovedAt: "2026-01-03T00:00:00Z"},
		{ID: "l1", VoucherNo: "记-4", Date: "2026-01-04", Status: "locked"},
		{ID: "c1", VoucherNo: "记-5", Date: "2026-01-05", Status: "approved", IsProfitLossClosing: &carry},
	})
	if err != nil {
		t.Fatalf("SaveVouchersBatch() error = %v", err)
	}

	approve, err := svc.ApproveVouchersBatch(ctx, []string{"d1", "d2", "a1", "missing", "d1"})
	if err != nil {
		t.Fatalf("ApproveVouchersBatch() error = %v", err)
	}
	if approve.Approved != 2 || approve.Skipped != 2 {
		t.Fatalf("ApproveVouchersBatch() = %+v, want approved=2 skipped=2", approve)
	}
	got, _ := svc.GetVoucher(ctx, "d1")
	if got.Status != "approved" || got.ApprovedAt == "" {
		t.Fatalf("d1 after approve = %+v", got)
	}

	unapprove, err := svc.UnapproveVouchersBatch(ctx, []string{"d1", "l1", "c1", "missing"})
	if err != nil {
		t.Fatalf("UnapproveVouchersBatch() error = %v", err)
	}
	if unapprove.Unapproved != 1 || unapprove.Skipped != 1 || len(unapprove.Failed) != 2 {
		t.Fatalf("UnapproveVouchersBatch() = %+v", unapprove)
	}
	got, _ = svc.GetVoucher(ctx, "d1")
	if got.Status != "draft" || got.ApprovedAt != "" {
		t.Fatalf("d1 after unapprove = %+v", got)
	}

	del, err := svc.DeleteVouchersBatch(ctx, []string{"d2", "l1", "c1", "missing"})
	if err != nil {
		t.Fatalf("DeleteVouchersBatch() error = %v", err)
	}
	// d2 was approved then still exists as approved from earlier - wait d2 was approved in approve batch
	// d2 status is approved, not locked/CF -> should delete
	// l1 locked fail, c1 CF fail, missing skipped
	if del.Deleted != 1 || del.Skipped != 1 || len(del.Failed) != 2 {
		t.Fatalf("DeleteVouchersBatch() = %+v, want deleted=1 skipped=1 failed=2", del)
	}
}

// TestErpService_Attachments 覆盖附件 CRUD。
func TestErpService_Attachments(t *testing.T) {
	svc := NewErpService(newMemoryErpRepo(), nil)
	ctx := context.Background()

	_, err := svc.GetAttachment(ctx, "missing")
	if err == nil || err.Error() != "附件不存在" {
		t.Fatalf("GetAttachment missing = %v", err)
	}
	_, err = svc.SaveAttachment(ctx, &model.Attachment{Name: "a.pdf"})
	if err == nil {
		t.Fatal("SaveAttachment empty id should fail")
	}

	saved, err := svc.SaveAttachment(ctx, &model.Attachment{
		ID: "att1", Name: "a.pdf", Type: "application/pdf", Size: 12, URL: "https://example.com/a.pdf", UploadedAt: "2026-01-01T00:00:00Z",
	})
	if err != nil || saved.Name != "a.pdf" {
		t.Fatalf("SaveAttachment() = %+v, %v", saved, err)
	}

	got, err := svc.GetAttachment(ctx, "att1")
	if err != nil || got.Size != 12 {
		t.Fatalf("GetAttachment() = %+v, %v", got, err)
	}
	list, err := svc.ListAttachments(ctx)
	if err != nil || len(list) != 1 {
		t.Fatalf("ListAttachments() = %v, %v", list, err)
	}
	if err := svc.DeleteAttachment(ctx, "att1"); err != nil {
		t.Fatalf("DeleteAttachment() error = %v", err)
	}
	if err := svc.ClearAttachments(ctx); err != nil {
		t.Fatalf("ClearAttachments() error = %v", err)
	}
}

// TestErpService_AuditLogs 覆盖追加审计日志、截断 UA、查询与清空。
func TestErpService_AuditLogs(t *testing.T) {
	svc := NewErpService(newMemoryErpRepo(), nil)
	ctx := context.Background()

	_, err := svc.GetAuditLog(ctx, "missing")
	if err == nil || err.Error() != "审计日志不存在" {
		t.Fatalf("GetAuditLog missing = %v", err)
	}

	longUA := make([]byte, 120)
	for i := range longUA {
		longUA[i] = 'a'
	}
	log, err := svc.AddAuditLog(ctx, "create", "voucher:1", "创建凭证", string(longUA))
	if err != nil {
		t.Fatalf("AddAuditLog() error = %v", err)
	}
	if log.ID == "" || log.Timestamp == "" {
		t.Fatalf("AddAuditLog should fill id/timestamp: %+v", log)
	}
	if len(log.UserAgent) != 100 {
		t.Fatalf("UserAgent length = %d, want 100", len(log.UserAgent))
	}

	got, err := svc.GetAuditLog(ctx, log.ID)
	if err != nil || got.Action != "create" {
		t.Fatalf("GetAuditLog() = %+v, %v", got, err)
	}
	list, err := svc.ListAuditLogs(ctx, 0)
	if err != nil || len(list) != 1 {
		t.Fatalf("ListAuditLogs() = %v, %v", list, err)
	}
	if err := svc.ClearAuditLogs(ctx); err != nil {
		t.Fatalf("ClearAuditLogs() error = %v", err)
	}
}

// TestErpService_Settings 覆盖设置读写删除与缺失返回 nil。
func TestErpService_Settings(t *testing.T) {
	svc := NewErpService(newMemoryErpRepo(), nil)
	ctx := context.Background()

	val, err := svc.GetSetting(ctx, "companyName")
	if err != nil || val != nil {
		t.Fatalf("GetSetting missing = %v, %v", val, err)
	}

	_, err = svc.SetSetting(ctx, "", json.RawMessage(`"x"`))
	if err == nil {
		t.Fatal("SetSetting empty key should fail")
	}

	saved, err := svc.SetSetting(ctx, "companyName", json.RawMessage(`"测试公司"`))
	if err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}
	if string(saved.Value) != `"测试公司"` {
		t.Fatalf("saved.Value = %s", saved.Value)
	}

	val, err = svc.GetSetting(ctx, "companyName")
	if err != nil || string(val) != `"测试公司"` {
		t.Fatalf("GetSetting() = %s, %v", val, err)
	}

	list, err := svc.ListSettings(ctx)
	if err != nil || len(list) != 1 {
		t.Fatalf("ListSettings() = %v, %v", list, err)
	}

	if err := svc.DeleteSetting(ctx, "companyName"); err != nil {
		t.Fatalf("DeleteSetting() error = %v", err)
	}
	if err := svc.ClearSettings(ctx); err != nil {
		t.Fatalf("ClearSettings() error = %v", err)
	}
}

// TestErpService_ExportImport 覆盖全量导出与导入替换。
func TestErpService_ExportImport(t *testing.T) {
	repo := newMemoryErpRepo()
	svc := NewErpService(repo, nil)
	ctx := context.Background()

	_, _ = svc.SaveChartAccount(ctx, &model.ChartAccount{ID: "a1", Code: "1002", Name: "银行存款", Category: "资产", Direction: "debit"})
	_, _ = svc.SaveVoucher(ctx, &model.Voucher{ID: "v1", VoucherNo: "记-1", Date: "2026-01-01", Status: "draft", Entries: datatypes.JSON("[]")})
	_, _ = svc.SetSetting(ctx, "companyName", json.RawMessage(`"ACME"`))

	exported, err := svc.ExportAll(ctx)
	if err != nil {
		t.Fatalf("ExportAll() error = %v", err)
	}
	if exported.Version != 1 || len(exported.Accounts) != 1 || len(exported.Vouchers) != 1 {
		t.Fatalf("unexpected export: %+v", exported)
	}

	if err := svc.ImportAll(ctx, nil); err == nil {
		t.Fatal("ImportAll nil should fail")
	}

	payload := &model.ExportData{
		Version: 1,
		Accounts: []model.ChartAccount{
			{ID: "a2", Code: "1122", Name: "应收账款", Category: "资产", Direction: "debit"},
		},
		Vouchers:    []model.Voucher{},
		AuditLogs:   []model.AuditLog{},
		Settings:    []model.Setting{{Key: "companyName", Value: datatypes.JSON(`"NEW"`)}},
		Attachments: []model.Attachment{},
	}
	if err := svc.ImportAll(ctx, payload); err != nil {
		t.Fatalf("ImportAll() error = %v", err)
	}

	accounts, _ := svc.ListChartAccounts(ctx)
	if len(accounts) != 1 || accounts[0].ID != "a2" {
		t.Fatalf("after import accounts = %+v", accounts)
	}
	vouchers, _ := svc.ListVouchers(ctx)
	if len(vouchers) != 0 {
		t.Fatalf("after import vouchers should be empty, got %d", len(vouchers))
	}
}
