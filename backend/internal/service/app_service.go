package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"erp/internal/data"
	"erp/internal/model"
	"erp/internal/repository"
	"gorm.io/datatypes"
)

type defaultAccountDef struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	Direction string `json:"direction"`
}

// AppInitResult 应用启动初始化结果。
type AppInitResult struct {
	CompanyName string               `json:"companyName"`
	Accounts    []model.ChartAccount `json:"accounts"`
	Repaired    int                  `json:"repaired"`
	SyncedLocks int                  `json:"syncedLocks"`
}

// AppService 应用级业务（启动初始化等）。
type AppService interface {
	Init(ctx context.Context) (*AppInitResult, error)
}

type appService struct {
	repo repository.ErpRepository
}

func NewAppService(repo repository.ErpRepository) AppService {
	return &appService{repo: repo}
}

// Init 应用启动初始化：同步默认科目、校正凭证分录科目名、同步已申报季度结项锁定。
func (s *appService) Init(ctx context.Context) (*AppInitResult, error) {
	if err := s.initChartAccounts(ctx); err != nil {
		return nil, err
	}
	repaired, err := s.syncVoucherEntryAccountNames(ctx)
	if err != nil {
		return nil, err
	}
	syncedLocks, err := s.syncDeclaredQuarterVoucherLocks(ctx)
	if err != nil {
		return nil, err
	}

	accounts, err := s.repo.ListChartAccounts(ctx)
	if err != nil {
		return nil, err
	}

	companyName := ""
	if setting, err := s.repo.GetSetting(ctx, "companyName"); err == nil {
		var name string
		if json.Unmarshal(setting.Value, &name) == nil {
			companyName = name
		}
	}

	return &AppInitResult{
		CompanyName: companyName,
		Accounts:    accounts,
		Repaired:    repaired,
		SyncedLocks: syncedLocks,
	}, nil
}

// initChartAccounts 去重、补齐默认科目并删除未使用的多余科目。
func (s *appService) initChartAccounts(ctx context.Context) error {
	defaults, err := loadDefaultAccounts()
	if err != nil {
		return err
	}
	defaultCodes := make(map[string]defaultAccountDef, len(defaults))
	for _, d := range defaults {
		defaultCodes[d.Code] = d
	}

	if err := s.dedupeChartAccounts(ctx); err != nil {
		return err
	}
	if err := s.syncDefaultChartAccounts(ctx, defaults); err != nil {
		return err
	}
	return s.pruneExtraChartAccounts(ctx, defaultCodes)
}

// loadDefaultAccounts 从内嵌 JSON 加载默认会计科目定义。
func loadDefaultAccounts() ([]defaultAccountDef, error) {
	var items []defaultAccountDef
	if err := json.Unmarshal(data.DefaultAccountsJSON, &items); err != nil {
		return nil, fmt.Errorf("解析默认科目失败: %w", err)
	}
	return items, nil
}

// dedupeChartAccounts 按科目编码去重，保留最早创建的一条。
func (s *appService) dedupeChartAccounts(ctx context.Context) error {
	items, err := s.repo.ListChartAccounts(ctx)
	if err != nil {
		return err
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt < items[j].CreatedAt
	})
	seen := map[string]bool{}
	for _, acc := range items {
		if seen[acc.Code] {
			if err := s.repo.DeleteChartAccount(ctx, acc.ID); err != nil {
				return err
			}
			continue
		}
		seen[acc.Code] = true
	}
	return nil
}

// syncDefaultChartAccounts 按默认科目表补齐缺失项，并校正名称/类别/余额方向。
func (s *appService) syncDefaultChartAccounts(ctx context.Context, defaults []defaultAccountDef) error {
	items, err := s.repo.ListChartAccounts(ctx)
	if err != nil {
		return err
	}
	byCode := map[string]model.ChartAccount{}
	for _, acc := range items {
		byCode[acc.Code] = acc
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, def := range defaults {
		current, ok := byCode[def.Code]
		if !ok {
			acc := model.ChartAccount{
				ID:        generateID(),
				Code:      def.Code,
				Name:      def.Name,
				Category:  def.Category,
				Direction: def.Direction,
				CreatedAt: now,
			}
			if err := s.repo.SaveChartAccount(ctx, &acc); err != nil {
				return err
			}
			continue
		}
		if current.Name != def.Name || current.Category != def.Category || current.Direction != def.Direction {
			current.Name = def.Name
			current.Category = def.Category
			current.Direction = def.Direction
			current.UpdatedAt = now
			if err := s.repo.SaveChartAccount(ctx, &current); err != nil {
				return err
			}
		}
	}
	return nil
}

// syncVoucherEntryAccountNames 用科目主数据回填凭证分录中的 accountCode / accountName。
func (s *appService) syncVoucherEntryAccountNames(ctx context.Context) (int, error) {
	accounts, err := s.repo.ListChartAccounts(ctx)
	if err != nil {
		return 0, err
	}
	byID := map[string]model.ChartAccount{}
	for _, acc := range accounts {
		byID[acc.ID] = acc
	}
	vouchers, err := s.repo.ListVouchers(ctx)
	if err != nil {
		return 0, err
	}
	updated := 0
	for i := range vouchers {
		v := &vouchers[i]
		changed := false
		var entries []map[string]interface{}
		if err := json.Unmarshal(v.Entries, &entries); err != nil {
			continue
		}
		for j := range entries {
			accountID, _ := entries[j]["accountId"].(string)
			acc, ok := byID[accountID]
			if !ok {
				continue
			}
			if entries[j]["accountName"] != acc.Name || entries[j]["accountCode"] != acc.Code {
				entries[j]["accountName"] = acc.Name
				entries[j]["accountCode"] = acc.Code
				changed = true
			}
		}
		if changed {
			raw, _ := json.Marshal(entries)
			v.Entries = datatypes.JSON(raw)
			if err := s.repo.SaveVoucher(ctx, v); err != nil {
				return updated, err
			}
			updated++
		}
	}
	return updated, nil
}

// pruneExtraChartAccounts 删除非默认且未被任何凭证引用的科目。
func (s *appService) pruneExtraChartAccounts(ctx context.Context, defaultCodes map[string]defaultAccountDef) error {
	items, err := s.repo.ListChartAccounts(ctx)
	if err != nil {
		return err
	}
	vouchers, err := s.repo.ListVouchers(ctx)
	if err != nil {
		return err
	}
	used := map[string]bool{}
	for _, v := range vouchers {
		var entries []map[string]interface{}
		if json.Unmarshal(v.Entries, &entries) != nil {
			continue
		}
		for _, e := range entries {
			if id, ok := e["accountId"].(string); ok && id != "" {
				used[id] = true
			}
		}
	}
	for _, acc := range items {
		if _, isDefault := defaultCodes[acc.Code]; isDefault {
			continue
		}
		if used[acc.ID] {
			continue
		}
		if err := s.repo.DeleteChartAccount(ctx, acc.ID); err != nil {
			return err
		}
	}
	return nil
}

type declaredQuarterRecord struct {
	PeriodKey string `json:"periodKey"`
	Year      int    `json:"year"`
	Quarter   int    `json:"quarter"`
}

// syncDeclaredQuarterVoucherLocks 根据 settings.declaredQuarters 将已申报季度内凭证结项锁定。
func (s *appService) syncDeclaredQuarterVoucherLocks(ctx context.Context) (int, error) {
	setting, err := s.repo.GetSetting(ctx, "declaredQuarters")
	if err != nil {
		return 0, nil
	}
	var list []declaredQuarterRecord
	if json.Unmarshal(setting.Value, &list) != nil {
		return 0, nil
	}
	total := 0
	for _, record := range list {
		n, err := s.lockVouchersInQuarter(ctx, record.Year, record.Quarter, record.PeriodKey)
		if err != nil {
			return total, err
		}
		total += n
	}
	return total, nil
}

// lockVouchersInQuarter 将指定季度内非草稿凭证状态设为 locked，并写入季度申报键。
func (s *appService) lockVouchersInQuarter(ctx context.Context, year, quarter int, periodKey string) (int, error) {
	startMonth := (quarter-1)*3 + 1
	endMonth := startMonth + 2
	startDate := fmt.Sprintf("%04d-%02d-01", year, startMonth)
	endDate := fmt.Sprintf("%04d-%02d-%02d", year, endMonth, daysInMonth(year, endMonth))

	vouchers, err := s.repo.ListVouchers(ctx)
	if err != nil {
		return 0, err
	}
	locked := 0
	now := time.Now().UTC().Format(time.RFC3339)
	for i := range vouchers {
		v := &vouchers[i]
		if v.Status == "draft" {
			continue
		}
		if v.Date < startDate || v.Date > endDate {
			continue
		}
		if v.Status == "locked" && v.QuarterDeclaredKey == periodKey {
			continue
		}
		v.Status = "locked"
		v.QuarterDeclaredKey = periodKey
		v.LockedAt = now
		if err := s.repo.SaveVoucher(ctx, v); err != nil {
			return locked, err
		}
		locked++
	}
	return locked, nil
}

// daysInMonth 返回公历某年某月的天数。
func daysInMonth(year, month int) int {
	t := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	return t.Day()
}
