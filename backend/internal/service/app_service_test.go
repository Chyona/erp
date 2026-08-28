package service

import (
	"context"
	"encoding/json"
	"testing"

	"erp/internal/model"
	"gorm.io/datatypes"
)

// TestAppService_Init_SeedsDefaultAccounts 验证空库初始化会写入默认科目。
func TestAppService_Init_SeedsDefaultAccounts(t *testing.T) {
	repo := newMemoryErpRepo()
	svc := NewAppService(repo)
	ctx := context.Background()

	_ = repo.SaveSetting(ctx, &model.Setting{Key: "companyName", Value: datatypes.JSON(`"示例公司"`)})

	result, err := svc.Init(ctx)
	if err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	if result.CompanyName != "示例公司" {
		t.Fatalf("CompanyName = %q", result.CompanyName)
	}
	if len(result.Accounts) < 20 {
		t.Fatalf("Accounts len = %d, want >= 20", len(result.Accounts))
	}
	if result.Repaired != 0 || result.SyncedLocks != 0 {
		t.Fatalf("fresh init repaired/syncedLocks = %d/%d", result.Repaired, result.SyncedLocks)
	}
}

// TestAppService_Init_RepairsEntryNames 验证凭证分录科目名会按科目主数据校正。
func TestAppService_Init_RepairsEntryNames(t *testing.T) {
	repo := newMemoryErpRepo()
	svc := NewAppService(repo)
	ctx := context.Background()

	acc := model.ChartAccount{
		ID: "acc-cash", Code: "1002", Name: "银行存款", Category: "资产", Direction: "debit", CreatedAt: "2026-01-01T00:00:00Z",
	}
	_ = repo.SaveChartAccount(ctx, &acc)

	entries, _ := json.Marshal([]map[string]interface{}{
		{"accountId": "acc-cash", "accountCode": "OLD", "accountName": "旧名", "summary": "收款", "debit": 100.0, "credit": 0.0},
	})
	_ = repo.SaveVoucher(ctx, &model.Voucher{
		ID: "v1", Date: "2026-02-01", Status: "approved", Entries: datatypes.JSON(entries),
	})

	result, err := svc.Init(ctx)
	if err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	if result.Repaired != 1 {
		t.Fatalf("Repaired = %d, want 1", result.Repaired)
	}

	v, _ := repo.GetVoucher(ctx, "v1")
	var parsed []map[string]interface{}
	_ = json.Unmarshal(v.Entries, &parsed)
	if parsed[0]["accountCode"] != "1002" || parsed[0]["accountName"] != "银行存款" {
		t.Fatalf("entries not repaired: %+v", parsed[0])
	}
}

// TestAppService_Init_LocksDeclaredQuarter 验证已申报季度内已审核凭证会被结项锁定。
func TestAppService_Init_LocksDeclaredQuarter(t *testing.T) {
	repo := newMemoryErpRepo()
	svc := NewAppService(repo)
	ctx := context.Background()

	quarters, _ := json.Marshal([]declaredQuarterRecord{
		{PeriodKey: "2026-Q1", Year: 2026, Quarter: 1},
	})
	_ = repo.SaveSetting(ctx, &model.Setting{Key: "declaredQuarters", Value: datatypes.JSON(quarters)})
	_ = repo.SaveVoucher(ctx, &model.Voucher{
		ID: "v1", Date: "2026-02-15", Status: "approved", Entries: datatypes.JSON("[]"),
	})
	_ = repo.SaveVoucher(ctx, &model.Voucher{
		ID: "v2", Date: "2026-02-16", Status: "draft", Entries: datatypes.JSON("[]"),
	})

	result, err := svc.Init(ctx)
	if err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	if result.SyncedLocks != 1 {
		t.Fatalf("SyncedLocks = %d, want 1", result.SyncedLocks)
	}

	v1, _ := repo.GetVoucher(ctx, "v1")
	if v1.Status != "locked" || v1.QuarterDeclaredKey != "2026-Q1" {
		t.Fatalf("v1 not locked: %+v", v1)
	}
	v2, _ := repo.GetVoucher(ctx, "v2")
	if v2.Status != "draft" {
		t.Fatalf("draft should stay draft, got %s", v2.Status)
	}
}

// TestAppService_Init_KeepsUnusedCustomAccounts 验证启动 init 不再自动删除未引用的自定义科目。
func TestAppService_Init_KeepsUnusedCustomAccounts(t *testing.T) {
	repo := newMemoryErpRepo()
	svc := NewAppService(repo)
	ctx := context.Background()

	_ = repo.SaveChartAccount(ctx, &model.ChartAccount{
		ID: "custom", Code: "9999", Name: "临时科目", Category: "资产", Direction: "debit", CreatedAt: "2026-01-01T00:00:00Z",
	})

	if _, err := svc.Init(ctx); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	if _, err := repo.GetChartAccount(ctx, "custom"); err != nil {
		t.Fatal("unused custom account should be kept after init")
	}
}

// TestDaysInMonth 校验公历月末天数计算。
func TestDaysInMonth(t *testing.T) {
	if daysInMonth(2024, 2) != 29 {
		t.Fatalf("2024-02 days = %d", daysInMonth(2024, 2))
	}
	if daysInMonth(2026, 2) != 28 {
		t.Fatalf("2026-02 days = %d", daysInMonth(2026, 2))
	}
}
