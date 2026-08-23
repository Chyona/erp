package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"erp/internal/model"
	"erp/internal/pkg/utils"
)

// VoucherListQuery 凭证列表查询（筛选 + 分页）。
type VoucherListQuery struct {
	Page          int
	PageSize      int
	StartDate     string
	EndDate       string
	Status        string
	VoucherType   string
	VoucherNumber string
	Summary       string
	AccountCode   string
	AmountMin     string
	AmountMax     string
	BusinessType  string
	Signatory     string
	Remark        string
	Keyword       string
}

type voucherEntry struct {
	Summary     string      `json:"summary"`
	AccountCode string      `json:"accountCode"`
	AccountName string      `json:"accountName"`
	Debit       interface{} `json:"debit"`
	Credit      interface{} `json:"credit"`
}

func (s *erpService) ListVouchersPage(ctx context.Context, q VoucherListQuery) ([]model.Voucher, int64, error) {
	items, err := s.repo.ListVouchers(ctx)
	if err != nil {
		return nil, 0, err
	}
	filtered := filterVouchers(items, q)
	sortVouchersDesc(filtered)
	total := int64(len(filtered))
	page, pageSize := utils.DefaultPage(q.Page, q.PageSize)
	start := (page - 1) * pageSize
	if start >= len(filtered) {
		return []model.Voucher{}, total, nil
	}
	end := start + pageSize
	if end > len(filtered) {
		end = len(filtered)
	}
	return filtered[start:end], total, nil
}

func filterVouchers(items []model.Voucher, q VoucherListQuery) []model.Voucher {
	out := make([]model.Voucher, 0, len(items))
	numberRanges := parseNumberRanges(q.VoucherNumber)
	codeRanges := parseCodeRanges(q.AccountCode)
	summaryKw := strings.ToLower(strings.TrimSpace(q.Summary))
	remarkKw := strings.ToLower(strings.TrimSpace(q.Remark))
	keywordKw := strings.ToLower(strings.TrimSpace(q.Keyword))
	amountMin, hasMin := parseOptionalFloat(q.AmountMin)
	amountMax, hasMax := parseOptionalFloat(q.AmountMax)
	signatoryKw := strings.ToLower(strings.TrimSpace(q.Signatory))

	for _, item := range items {
		if q.StartDate != "" && item.Date < q.StartDate {
			continue
		}
		if q.EndDate != "" && item.Date > q.EndDate {
			continue
		}
		if q.Status != "" && item.Status != q.Status {
			continue
		}
		if q.VoucherType != "" && item.VoucherType != q.VoucherType {
			continue
		}
		if numberRanges != nil && !numberRanges[parseVoucherNum(item.VoucherNumber)] {
			continue
		}
		entries := parseVoucherEntries(item.Entries)
		if summaryKw != "" && !entrySummaryMatches(entries, summaryKw) {
			continue
		}
		if codeRanges != nil && !entryCodeMatches(entries, codeRanges) {
			continue
		}
		if (hasMin || hasMax) && !voucherAmountMatches(item, entries, amountMin, hasMin, amountMax, hasMax) {
			continue
		}
		if q.BusinessType != "" && item.BusinessType != q.BusinessType {
			continue
		}
		if signatoryKw != "" && !signatoryMatches(item, signatoryKw) {
			continue
		}
		if remarkKw != "" && !strings.Contains(strings.ToLower(item.Remark), remarkKw) {
			continue
		}
		if keywordKw != "" && !keywordMatches(item, entries, keywordKw) {
			continue
		}
		out = append(out, item)
	}
	return out
}

func parseVoucherEntries(raw []byte) []voucherEntry {
	if len(raw) == 0 {
		return nil
	}
	var entries []voucherEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil
	}
	return entries
}

func entrySummaryMatches(entries []voucherEntry, kw string) bool {
	for _, e := range entries {
		if strings.Contains(strings.ToLower(e.Summary), kw) {
			return true
		}
	}
	return false
}

func entryCodeMatches(entries []voucherEntry, codes map[string]bool) bool {
	for _, e := range entries {
		code := strings.TrimSpace(e.AccountCode)
		if code != "" && codes[code] {
			return true
		}
	}
	return false
}

func voucherAmountMatches(
	item model.Voucher,
	entries []voucherEntry,
	min float64,
	hasMin bool,
	max float64,
	hasMax bool,
) bool {
	amounts := make([]float64, 0, 2+len(entries)*2)
	if item.TotalDebit > 0 {
		amounts = append(amounts, item.TotalDebit)
	}
	if item.TotalCredit > 0 {
		amounts = append(amounts, item.TotalCredit)
	}
	for _, e := range entries {
		if n := parseEntryAmount(e.Debit); n > 0 {
			amounts = append(amounts, n)
		}
		if n := parseEntryAmount(e.Credit); n > 0 {
			amounts = append(amounts, n)
		}
	}
	if len(amounts) == 0 {
		return false
	}
	for _, amount := range amounts {
		if hasMin && amount < min {
			continue
		}
		if hasMax && amount > max {
			continue
		}
		return true
	}
	return false
}

func parseEntryAmount(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(n), 64)
		if err != nil {
			return 0
		}
		return f
	default:
		return 0
	}
}

func signatoryMatches(item model.Voucher, kw string) bool {
	fields := []string{item.PreparedBy, item.ReviewedBy, item.PostedBy, item.CashierBy}
	for _, value := range fields {
		if value != "" && strings.Contains(strings.ToLower(value), kw) {
			return true
		}
	}
	return false
}

func keywordMatches(item model.Voucher, entries []voucherEntry, kw string) bool {
	if strings.Contains(strings.ToLower(item.VoucherNo), kw) {
		return true
	}
	if strings.Contains(strings.ToLower(item.Remark), kw) {
		return true
	}
	for _, e := range entries {
		if strings.Contains(strings.ToLower(e.Summary), kw) {
			return true
		}
		if e.AccountName != "" && strings.Contains(strings.ToLower(e.AccountName), kw) {
			return true
		}
	}
	return false
}

func sortVouchersDesc(items []model.Voucher) {
	sort.Slice(items, func(i, j int) bool {
		a := items[i]
		b := items[j]
		if a.Date != b.Date {
			return a.Date > b.Date
		}
		numA := parseVoucherNum(a.VoucherNumber)
		numB := parseVoucherNum(b.VoucherNumber)
		if numA != numB {
			return numA > numB
		}
		return a.VoucherNo > b.VoucherNo
	})
}

var voucherDigitsRe = regexp.MustCompile(`\d+`)

func parseVoucherNum(value string) int {
	match := voucherDigitsRe.FindString(value)
	if match == "" {
		return 0
	}
	n, _ := strconv.Atoi(match)
	return n
}

func parseOptionalFloat(raw string) (float64, bool) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return 0, false
	}
	n, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}

func parseNumberRanges(text string) map[int]bool {
	raw := strings.TrimSpace(text)
	if raw == "" {
		return nil
	}
	result := map[int]bool{}
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == '，' }) {
		segment := strings.TrimSpace(part)
		if segment == "" {
			continue
		}
		if strings.Contains(segment, "-") {
			bounds := strings.SplitN(segment, "-", 2)
			start := parseVoucherNum(bounds[0])
			end := parseVoucherNum(bounds[1])
			lo := int(math.Min(float64(start), float64(end)))
			hi := int(math.Max(float64(start), float64(end)))
			for n := lo; n <= hi; n++ {
				result[n] = true
			}
			continue
		}
		result[parseVoucherNum(segment)] = true
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func parseCodeRanges(text string) map[string]bool {
	raw := strings.TrimSpace(text)
	if raw == "" {
		return nil
	}
	result := map[string]bool{}
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == '，' }) {
		segment := strings.TrimSpace(part)
		if segment == "" {
			continue
		}
		if strings.Contains(segment, "-") {
			bounds := strings.SplitN(segment, "-", 2)
			startText := voucherDigitsRe.FindString(bounds[0])
			endText := voucherDigitsRe.FindString(bounds[1])
			start, _ := strconv.Atoi(startText)
			end, _ := strconv.Atoi(endText)
			lo := int(math.Min(float64(start), float64(end)))
			hi := int(math.Max(float64(start), float64(end)))
			width := len(startText)
			if len(endText) > width {
				width = len(endText)
			}
			for n := lo; n <= hi; n++ {
				result[fmt.Sprintf("%0*d", width, n)] = true
			}
			continue
		}
		result[strings.ReplaceAll(segment, " ", "")] = true
	}
	if len(result) == 0 {
		return nil
	}
	return result
}
