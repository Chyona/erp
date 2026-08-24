package service

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"erp/internal/model"
	"github.com/google/uuid"
)

const (
	backupFormatVersion = "erp-backup-v1"
	maxBackupCount      = 5
)

type backupFile struct {
	Format  string `json:"format"`
	Payload string `json:"payload"`
}

// BackupService 管理服务端备份文件（本地目录）。
type BackupService interface {
	List(ctx context.Context) ([]model.BackupRecord, error)
	Create(ctx context.Context, name string, data *model.ExportData) (*model.BackupRecord, error)
	Upload(ctx context.Context, name string, content []byte) (*model.BackupRecord, error)
	Read(ctx context.Context, id string) (*model.ExportData, error)
	Download(ctx context.Context, id string) ([]byte, string, error)
	Rename(ctx context.Context, id, name string) (*model.BackupRecord, error)
	Delete(ctx context.Context, id string) error
	BatchDelete(ctx context.Context, ids []string) error
}

type backupService struct {
	dir string
	mu  sync.Mutex
}

func NewBackupService(dir string) BackupService {
	if strings.TrimSpace(dir) == "" {
		dir = "./data/erp-backups"
	}
	return &backupService{dir: dir}
}

func (s *backupService) indexPath() string {
	return filepath.Join(s.dir, "index.json")
}

func (s *backupService) filePath(id string) string {
	return filepath.Join(s.dir, id+".bak")
}

func (s *backupService) ensureDir() error {
	return os.MkdirAll(s.dir, 0o755)
}

func (s *backupService) loadIndex() ([]model.BackupRecord, error) {
	if err := s.ensureDir(); err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(s.indexPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []model.BackupRecord{}, nil
		}
		return nil, err
	}
	var items []model.BackupRecord
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, err
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt > items[j].CreatedAt
	})
	return items, nil
}

func (s *backupService) saveIndex(items []model.BackupRecord) error {
	if err := s.ensureDir(); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.indexPath(), raw, 0o644)
}

func encodeBackup(data *model.ExportData) ([]byte, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	if _, err := gw.Write(raw); err != nil {
		return nil, err
	}
	if err := gw.Close(); err != nil {
		return nil, err
	}
	wrapper := backupFile{
		Format:  backupFormatVersion,
		Payload: base64.StdEncoding.EncodeToString(buf.Bytes()),
	}
	return json.Marshal(wrapper)
}

func decodeBackup(content []byte) (*model.ExportData, error) {
	content = bytes.TrimSpace(content)
	if len(content) == 0 {
		return nil, errors.New("备份文件为空")
	}

	var wrapper backupFile
	if err := json.Unmarshal(content, &wrapper); err == nil && wrapper.Payload != "" {
		gzRaw, err := base64.StdEncoding.DecodeString(wrapper.Payload)
		if err != nil {
			return nil, fmt.Errorf("备份文件格式无效")
		}
		gr, err := gzip.NewReader(bytes.NewReader(gzRaw))
		if err != nil {
			return nil, fmt.Errorf("备份文件格式无效")
		}
		defer gr.Close()
		decoded, err := io.ReadAll(gr)
		if err != nil {
			return nil, err
		}
		content = decoded
	}

	var data model.ExportData
	if err := json.Unmarshal(content, &data); err != nil {
		return nil, fmt.Errorf("无效的备份文件")
	}
	if data.Vouchers == nil {
		return nil, fmt.Errorf("无效的备份文件")
	}
	return &data, nil
}

func defaultBackupName() string {
	return "b" + time.Now().Format("20060102")
}

func sanitizeBackupName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return defaultBackupName()
	}
	name = strings.ReplaceAll(name, string(os.PathSeparator), "_")
	name = strings.ReplaceAll(name, "..", "_")
	if len(name) > 64 {
		name = name[:64]
	}
	return name
}

func (s *backupService) trimOverflow(items []model.BackupRecord) error {
	if len(items) <= maxBackupCount {
		return nil
	}
	overflow := items[maxBackupCount:]
	items = items[:maxBackupCount]
	for _, item := range overflow {
		_ = os.Remove(s.filePath(item.ID))
	}
	return s.saveIndex(items)
}

func (s *backupService) addRecord(source string, name string, content []byte) (*model.BackupRecord, error) {
	name = sanitizeBackupName(name)
	items, err := s.loadIndex()
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	record := model.BackupRecord{
		ID:        id,
		Name:      name,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Size:      int64(len(content)),
		Source:    source,
	}
	if err := os.WriteFile(s.filePath(id), content, 0o644); err != nil {
		return nil, err
	}
	items = append([]model.BackupRecord{record}, items...)
	if err := s.saveIndex(items); err != nil {
		_ = os.Remove(s.filePath(id))
		return nil, err
	}
	if err := s.trimOverflow(items); err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *backupService) List(ctx context.Context) ([]model.BackupRecord, error) {
	_ = ctx
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadIndex()
}

func (s *backupService) Create(ctx context.Context, name string, data *model.ExportData) (*model.BackupRecord, error) {
	_ = ctx
	if data == nil {
		return nil, errors.New("备份数据不能为空")
	}
	content, err := encodeBackup(data)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.addRecord("manual", name, content)
}

func (s *backupService) Upload(ctx context.Context, name string, content []byte) (*model.BackupRecord, error) {
	_ = ctx
	if _, err := decodeBackup(content); err != nil {
		return nil, err
	}
	encoded, err := encodeBackupFromRaw(content)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.addRecord("upload", name, encoded)
}

func encodeBackupFromRaw(content []byte) ([]byte, error) {
	data, err := decodeBackup(content)
	if err != nil {
		return nil, err
	}
	return encodeBackup(data)
}

func (s *backupService) findRecord(items []model.BackupRecord, id string) (*model.BackupRecord, int) {
	for i := range items {
		if items[i].ID == id {
			return &items[i], i
		}
	}
	return nil, -1
}

func (s *backupService) Read(ctx context.Context, id string) (*model.ExportData, error) {
	_ = ctx
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.loadIndex()
	if err != nil {
		return nil, err
	}
	if _, idx := s.findRecord(items, id); idx < 0 {
		return nil, errors.New("备份不存在")
	}
	content, err := os.ReadFile(s.filePath(id))
	if err != nil {
		return nil, err
	}
	return decodeBackup(content)
}

func (s *backupService) Download(ctx context.Context, id string) ([]byte, string, error) {
	_ = ctx
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.loadIndex()
	if err != nil {
		return nil, "", err
	}
	record, idx := s.findRecord(items, id)
	if idx < 0 {
		return nil, "", errors.New("备份不存在")
	}
	content, err := os.ReadFile(s.filePath(id))
	if err != nil {
		return nil, "", err
	}
	filename := record.Name
	if !strings.HasSuffix(strings.ToLower(filename), ".bak") {
		filename += ".bak"
	}
	return content, filename, nil
}

func (s *backupService) Rename(ctx context.Context, id, name string) (*model.BackupRecord, error) {
	_ = ctx
	name = sanitizeBackupName(name)
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.loadIndex()
	if err != nil {
		return nil, err
	}
	record, idx := s.findRecord(items, id)
	if record == nil {
		return nil, errors.New("备份不存在")
	}
	items[idx].Name = name
	if err := s.saveIndex(items); err != nil {
		return nil, err
	}
	updated := items[idx]
	return &updated, nil
}

func (s *backupService) Delete(ctx context.Context, id string) error {
	_ = ctx
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.loadIndex()
	if err != nil {
		return err
	}
	record, idx := s.findRecord(items, id)
	if record == nil {
		return errors.New("备份不存在")
	}
	items = append(items[:idx], items[idx+1:]...)
	if err := s.saveIndex(items); err != nil {
		return err
	}
	if err := os.Remove(s.filePath(id)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *backupService) BatchDelete(ctx context.Context, ids []string) error {
	_ = ctx
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.loadIndex()
	if err != nil {
		return err
	}
	idSet := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if strings.TrimSpace(id) != "" {
			idSet[id] = struct{}{}
		}
	}
	next := make([]model.BackupRecord, 0, len(items))
	for _, item := range items {
		if _, ok := idSet[item.ID]; ok {
			_ = os.Remove(s.filePath(item.ID))
			continue
		}
		next = append(next, item)
	}
	return s.saveIndex(next)
}
