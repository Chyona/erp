package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"erp/internal/model"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// stubErpService 可配置行为的 ErpService 桩，用于 Handler 单元测试。
type stubErpService struct {
	accounts    []model.ChartAccount
	account     *model.ChartAccount
	vouchers    []model.Voucher
	voucher     *model.Voucher
	attachments []model.Attachment
	attachment  *model.Attachment
	auditLogs   []model.AuditLog
	auditLog    *model.AuditLog
	settings    []model.Setting
	settingVal  json.RawMessage
	exportData  *model.ExportData
	err         error
	notFound    bool
}

func (s *stubErpService) ListChartAccounts(ctx context.Context) ([]model.ChartAccount, error) {
	return s.accounts, s.err
}
func (s *stubErpService) GetChartAccount(ctx context.Context, id string) (*model.ChartAccount, error) {
	if s.notFound {
		return nil, errors.New("科目不存在")
	}
	return s.account, s.err
}
func (s *stubErpService) SaveChartAccount(ctx context.Context, account *model.ChartAccount) (*model.ChartAccount, error) {
	if s.err != nil {
		return nil, s.err
	}
	return account, nil
}
func (s *stubErpService) SaveChartAccountsBatch(ctx context.Context, accounts []model.ChartAccount) ([]model.ChartAccount, error) {
	if s.err != nil {
		return nil, s.err
	}
	return accounts, nil
}
func (s *stubErpService) DeleteChartAccount(ctx context.Context, id string) error {
	return s.err
}
func (s *stubErpService) DeleteChartAccountsBatch(ctx context.Context, ids []string) error {
	return s.err
}
func (s *stubErpService) ClearChartAccounts(ctx context.Context) error { return s.err }

func (s *stubErpService) ListVouchers(ctx context.Context) ([]model.Voucher, error) {
	return s.vouchers, s.err
}
func (s *stubErpService) GetVoucher(ctx context.Context, id string) (*model.Voucher, error) {
	if s.notFound {
		return nil, errors.New("凭证不存在")
	}
	return s.voucher, s.err
}
func (s *stubErpService) SaveVoucher(ctx context.Context, voucher *model.Voucher) (*model.Voucher, error) {
	if s.err != nil {
		return nil, s.err
	}
	return voucher, nil
}
func (s *stubErpService) SaveVouchersBatch(ctx context.Context, vouchers []model.Voucher) ([]model.Voucher, error) {
	if s.err != nil {
		return nil, s.err
	}
	return vouchers, nil
}
func (s *stubErpService) ApproveVouchersBatch(ctx context.Context, ids []string) (*service.VoucherBatchOpResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &service.VoucherBatchOpResult{Approved: len(ids), Failed: []service.VoucherBatchFailItem{}}, nil
}
func (s *stubErpService) UnapproveVouchersBatch(ctx context.Context, ids []string) (*service.VoucherBatchOpResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &service.VoucherBatchOpResult{Unapproved: len(ids), Failed: []service.VoucherBatchFailItem{}}, nil
}
func (s *stubErpService) DeleteVoucher(ctx context.Context, id string) error { return s.err }
func (s *stubErpService) DeleteVouchersBatch(ctx context.Context, ids []string) (*service.VoucherBatchOpResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &service.VoucherBatchOpResult{Deleted: len(ids), Failed: []service.VoucherBatchFailItem{}}, nil
}
func (s *stubErpService) ClearVouchers(ctx context.Context) error           { return s.err }

func (s *stubErpService) ListAttachments(ctx context.Context) ([]model.Attachment, error) {
	return s.attachments, s.err
}
func (s *stubErpService) GetAttachment(ctx context.Context, id string) (*model.Attachment, error) {
	if s.notFound {
		return nil, errors.New("附件不存在")
	}
	return s.attachment, s.err
}
func (s *stubErpService) SaveAttachment(ctx context.Context, attachment *model.Attachment) (*model.Attachment, error) {
	if s.err != nil {
		return nil, s.err
	}
	return attachment, nil
}
func (s *stubErpService) UploadAttachment(ctx context.Context, id, name, contentType, voucherDate string, r io.Reader, size int64) (*model.Attachment, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.attachment != nil {
		return s.attachment, nil
	}
	return &model.Attachment{
		ID:   id,
		Name: name,
		Type: contentType,
		Size: size,
		URL:  "https://example.com/" + id,
	}, nil
}
func (s *stubErpService) SaveAttachmentsBatch(ctx context.Context, items []model.Attachment) ([]model.Attachment, error) {
	if s.err != nil {
		return nil, s.err
	}
	return items, nil
}
func (s *stubErpService) DeleteAttachment(ctx context.Context, id string) error { return s.err }
func (s *stubErpService) DeleteAttachmentsBatch(ctx context.Context, ids []string) error {
	return s.err
}
func (s *stubErpService) ClearAttachments(ctx context.Context) error            { return s.err }

func (s *stubErpService) ListAuditLogs(ctx context.Context, limit int) ([]model.AuditLog, error) {
	return s.auditLogs, s.err
}
func (s *stubErpService) GetAuditLog(ctx context.Context, id string) (*model.AuditLog, error) {
	if s.notFound {
		return nil, errors.New("审计日志不存在")
	}
	return s.auditLog, s.err
}
func (s *stubErpService) AddAuditLog(ctx context.Context, action, target, details, userAgent string) (*model.AuditLog, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &model.AuditLog{ID: "log1", Action: action, Target: target, Details: details, UserAgent: userAgent}, nil
}
func (s *stubErpService) ClearAuditLogs(ctx context.Context) error { return s.err }

func (s *stubErpService) ListSettings(ctx context.Context) ([]model.Setting, error) {
	return s.settings, s.err
}
func (s *stubErpService) GetSetting(ctx context.Context, key string) (json.RawMessage, error) {
	return s.settingVal, s.err
}
func (s *stubErpService) SetSetting(ctx context.Context, key string, value json.RawMessage) (*model.Setting, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &model.Setting{Key: key, Value: datatypes.JSON(value)}, nil
}
func (s *stubErpService) SetSettingsBatch(ctx context.Context, items []service.SettingKV) ([]model.Setting, error) {
	if s.err != nil {
		return nil, s.err
	}
	out := make([]model.Setting, 0, len(items))
	for _, item := range items {
		out = append(out, model.Setting{Key: item.Key, Value: datatypes.JSON(item.Value)})
	}
	return out, nil
}
func (s *stubErpService) DeleteSetting(ctx context.Context, key string) error { return s.err }
func (s *stubErpService) ClearSettings(ctx context.Context) error            { return s.err }

func (s *stubErpService) ExportAll(ctx context.Context) (*model.ExportData, error) {
	return s.exportData, s.err
}
func (s *stubErpService) ImportAll(ctx context.Context, data *model.ExportData) error { return s.err }

type stubAppService struct {
	result *service.AppInitResult
	err    error
}

func (s *stubAppService) Init(ctx context.Context) (*service.AppInitResult, error) {
	return s.result, s.err
}

// decodeBody 解析统一响应信封。
func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v, raw=%s", err, w.Body.String())
	}
	return body
}

func TestErpHandler_ChartAccounts(t *testing.T) {
	stub := &stubErpService{
		accounts: []model.ChartAccount{{ID: "a1", Code: "1002", Name: "银行存款"}},
		account:  &model.ChartAccount{ID: "a1", Code: "1002", Name: "银行存款"},
	}
	h := NewErpHandler(stub, nil)
	r := gin.New()
	r.GET("/accounts", h.ListChartAccounts)
	r.GET("/accounts/:id", h.GetChartAccount)
	r.PUT("/accounts/:id", h.SaveChartAccount)
	r.DELETE("/accounts/:id", h.DeleteChartAccount)
	r.DELETE("/accounts", h.ClearChartAccounts)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/accounts", nil))
	body := decodeBody(t, w)
	if w.Code != 200 || body["code"].(float64) != 0 {
		t.Fatalf("ListChartAccounts = %d %v", w.Code, body)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/accounts/a1", nil))
	if w.Code != 200 {
		t.Fatalf("GetChartAccount status = %d", w.Code)
	}

	stub.notFound = true
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/accounts/x", nil))
	if w.Code != 404 {
		t.Fatalf("GetChartAccount missing status = %d", w.Code)
	}
	stub.notFound = false

	payload, _ := json.Marshal(model.ChartAccount{Code: "1002", Name: "银行存款", Category: "资产", Direction: "debit"})
	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/accounts/a1", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("SaveChartAccount status = %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/accounts/a1", nil))
	if w.Code != 200 {
		t.Fatalf("DeleteChartAccount status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/accounts", nil))
	if w.Code != 200 {
		t.Fatalf("ClearChartAccounts status = %d", w.Code)
	}
}

func TestErpHandler_Vouchers(t *testing.T) {
	stub := &stubErpService{
		vouchers: []model.Voucher{{ID: "v1", VoucherNo: "记-1"}},
		voucher:  &model.Voucher{ID: "v1", VoucherNo: "记-1"},
	}
	h := NewErpHandler(stub, nil)
	r := gin.New()
	r.GET("/vouchers", h.ListVouchers)
	r.GET("/vouchers/:id", h.GetVoucher)
	r.PUT("/vouchers/:id", h.SaveVoucher)
	r.DELETE("/vouchers/:id", h.DeleteVoucher)
	r.DELETE("/vouchers", h.ClearVouchers)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/vouchers", nil))
	if w.Code != 200 {
		t.Fatalf("ListVouchers status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/vouchers/v1", nil))
	if w.Code != 200 {
		t.Fatalf("GetVoucher status = %d", w.Code)
	}

	payload, _ := json.Marshal(model.Voucher{VoucherNo: "记-1", Date: "2026-01-01", Status: "draft"})
	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/vouchers/v1", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("SaveVoucher status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/vouchers/v1", nil))
	if w.Code != 200 {
		t.Fatalf("DeleteVoucher status = %d", w.Code)
	}
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/vouchers", nil))
	if w.Code != 200 {
		t.Fatalf("ClearVouchers status = %d", w.Code)
	}
}

func TestErpHandler_Attachments(t *testing.T) {
	stub := &stubErpService{
		attachments: []model.Attachment{{ID: "att1", Name: "a.pdf"}},
		attachment:  &model.Attachment{ID: "att1", Name: "a.pdf"},
	}
	h := NewErpHandler(stub, nil)
	r := gin.New()
	r.GET("/attachments", h.ListAttachments)
	r.GET("/attachments/:id", h.GetAttachment)
	r.PUT("/attachments/:id", h.SaveAttachment)
	r.DELETE("/attachments/:id", h.DeleteAttachment)
	r.DELETE("/attachments", h.ClearAttachments)

	for _, tc := range []struct {
		method, path string
		body         []byte
	}{
		{http.MethodGet, "/attachments", nil},
		{http.MethodGet, "/attachments/att1", nil},
		{http.MethodPut, "/attachments/att1", []byte(`{"name":"a.pdf","type":"application/pdf","size":1,"url":"https://example.com/a.pdf","uploadedAt":"2026-01-01T00:00:00Z"}`)},
		{http.MethodDelete, "/attachments/att1", nil},
		{http.MethodDelete, "/attachments", nil},
	} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(tc.body))
		if tc.body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		r.ServeHTTP(w, req)
		if w.Code != 200 {
			t.Fatalf("%s %s status = %d body=%s", tc.method, tc.path, w.Code, w.Body.String())
		}
	}
}

func TestErpHandler_AuditLogs(t *testing.T) {
	stub := &stubErpService{
		auditLogs: []model.AuditLog{{ID: "l1", Action: "create"}},
		auditLog:  &model.AuditLog{ID: "l1", Action: "create"},
	}
	h := NewErpHandler(stub, nil)
	r := gin.New()
	r.GET("/audit-logs", h.ListAuditLogs)
	r.GET("/audit-logs/:id", h.GetAuditLog)
	r.POST("/audit-logs", h.AddAuditLog)
	r.DELETE("/audit-logs", h.ClearAuditLogs)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/audit-logs?limit=0", nil))
	if w.Code != 200 {
		t.Fatalf("ListAuditLogs status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/audit-logs/l1", nil))
	if w.Code != 200 {
		t.Fatalf("GetAuditLog status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/audit-logs", bytes.NewReader([]byte(`{"action":"create","target":"v1","details":"ok"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "test-agent")
	r.ServeHTTP(w, req)
	body := decodeBody(t, w)
	if w.Code != 200 || body["code"].(float64) != 0 {
		t.Fatalf("AddAuditLog = %d %v", w.Code, body)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/audit-logs", nil))
	if w.Code != 200 {
		t.Fatalf("ClearAuditLogs status = %d", w.Code)
	}
}

func TestErpHandler_Settings(t *testing.T) {
	stub := &stubErpService{
		settings:   []model.Setting{{Key: "companyName", Value: datatypes.JSON(`"ACME"`)}},
		settingVal: json.RawMessage(`"ACME"`),
	}
	h := NewErpHandler(stub, nil)
	r := gin.New()
	r.GET("/settings", h.ListSettings)
	r.GET("/settings/:key", h.GetSetting)
	r.PUT("/settings/:key", h.SetSetting)
	r.DELETE("/settings/:key", h.DeleteSetting)
	r.DELETE("/settings", h.ClearSettings)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/settings", nil))
	if w.Code != 200 {
		t.Fatalf("ListSettings status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/settings/companyName", nil))
	body := decodeBody(t, w)
	data := body["data"].(map[string]interface{})
	if data["value"] != "ACME" {
		t.Fatalf("GetSetting value = %v", data["value"])
	}

	stub.settingVal = nil
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/settings/missing", nil))
	body = decodeBody(t, w)
	data = body["data"].(map[string]interface{})
	if data["value"] != nil {
		t.Fatalf("missing setting should return null value, got %v", data["value"])
	}

	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/settings/companyName", bytes.NewReader([]byte(`{"value":"NEW"}`)))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("SetSetting status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/settings/companyName", nil))
	if w.Code != 200 {
		t.Fatalf("DeleteSetting status = %d", w.Code)
	}
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/settings", nil))
	if w.Code != 200 {
		t.Fatalf("ClearSettings status = %d", w.Code)
	}
}

func TestErpHandler_ExportImport(t *testing.T) {
	stub := &stubErpService{
		exportData: &model.ExportData{Version: 1, ExportedAt: "2026-01-01T00:00:00Z"},
	}
	h := NewErpHandler(stub, nil)
	r := gin.New()
	r.GET("/data/export", h.ExportAll)
	r.POST("/data/import", h.ImportAll)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/data/export", nil))
	if w.Code != 200 {
		t.Fatalf("ExportAll status = %d", w.Code)
	}
	if w.Header().Get("Content-Disposition") == "" {
		t.Fatal("ExportAll should set Content-Disposition")
	}

	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/data/import", bytes.NewReader([]byte(`{"version":1,"exportedAt":"2026-01-01T00:00:00Z","vouchers":[],"accounts":[],"auditLogs":[],"settings":[],"attachments":[]}`)))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("ImportAll status = %d body=%s", w.Code, w.Body.String())
	}
}

func TestAppHandler_Init(t *testing.T) {
	app := &stubAppService{result: &service.AppInitResult{CompanyName: "ACME", Accounts: []model.ChartAccount{}, Repaired: 1, SyncedLocks: 2}}
	h := NewAppHandler(app)
	r := gin.New()
	r.POST("/app/init", h.Init)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/app/init", nil))
	body := decodeBody(t, w)
	if w.Code != 200 || body["code"].(float64) != 0 {
		t.Fatalf("Init = %d %v", w.Code, body)
	}
	data := body["data"].(map[string]interface{})
	if data["companyName"] != "ACME" || data["repaired"].(float64) != 1 {
		t.Fatalf("Init data = %v", data)
	}

	app.err = errors.New("boom")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/app/init", nil))
	if w.Code != 500 {
		t.Fatalf("Init error status = %d", w.Code)
	}
}
