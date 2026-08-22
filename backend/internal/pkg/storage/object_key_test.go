package storage

import (
	"context"
	"testing"
)

func TestResolveBasePath(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"", ""},
		{"erp", "erp"},
		{"/erp/", "erp"},
		{"custom/path", "custom/path"},
	}
	for _, tt := range tests {
		if got := ResolveBasePath(tt.input); got != tt.want {
			t.Errorf("ResolveBasePath(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestJoinObjectKey(t *testing.T) {
	tests := []struct {
		basePath  string
		objectKey string
		want      string
	}{
		{"erp", "test/main.go", "erp/test/main.go"},
		{"erp", "/temp/1.wav", "erp/temp/1.wav"},
		{"", "attachments/a.pdf", "attachments/a.pdf"},
		{"erp", "", "erp"},
	}
	for _, tt := range tests {
		if got := JoinObjectKey(tt.basePath, tt.objectKey); got != tt.want {
			t.Errorf("JoinObjectKey(%q, %q) = %q, want %q", tt.basePath, tt.objectKey, got, tt.want)
		}
	}
}

func TestClient_UploadFile_WithBasePath(t *testing.T) {
	var gotKey string
	client := &Client{
		basePath: "erp",
		provider: &mockStorageProvider{
			uploadFileFn: func(ctx context.Context, localPath, objectKey string) (string, error) {
				gotKey = objectKey
				return "https://cdn.example.com/" + objectKey, nil
			},
		},
	}

	_, err := client.UploadFile(context.Background(), "/tmp/a.txt", "test/a.txt")
	if err != nil {
		t.Fatalf("UploadFile() error = %v", err)
	}
	if gotKey != "erp/test/a.txt" {
		t.Errorf("objectKey = %q, want erp/test/a.txt", gotKey)
	}
}

func TestClient_ObjectKey(t *testing.T) {
	client := &Client{basePath: ""}
	if got := client.ObjectKey("attachments", "1", "a.pdf"); got != "attachments/1/a.pdf" {
		t.Errorf("ObjectKey() = %q, want attachments/1/a.pdf", got)
	}
}

func TestAttachmentObjectKey(t *testing.T) {
	tests := []struct {
		year, month, id, fileName, want string
	}{
		{"2026", "8", "att1", "a.pdf", "attachments/2026/08/a.pdf"},
		{"2026", "08", "att1", "记-021.pdf", "attachments/2026/08/记-021.pdf"},
		{"2026", "12", "", "a.pdf", "attachments/2026/12/a.pdf"},
		{"", "", "att1", "", "attachments/unknown/00/att1"},
	}
	for _, tt := range tests {
		if got := AttachmentObjectKey(tt.year, tt.month, tt.id, tt.fileName); got != tt.want {
			t.Errorf("AttachmentObjectKey(%q,%q,%q,%q) = %q, want %q",
				tt.year, tt.month, tt.id, tt.fileName, got, tt.want)
		}
	}
}

func TestObjectKeyFromPublicURL(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"https://erp-1426793176.cos.ap-guangzhou.myqcloud.com/attachments/2026/08/a.pdf", "attachments/2026/08/a.pdf"},
		{"https://example.com/video_editing/attachments/id/a.pdf?sign=1", "video_editing/attachments/id/a.pdf"},
		{"data:image/png;base64,xxx", ""},
		{"", ""},
	}
	for _, tt := range tests {
		if got := ObjectKeyFromPublicURL(tt.url); got != tt.want {
			t.Errorf("ObjectKeyFromPublicURL(%q) = %q, want %q", tt.url, got, tt.want)
		}
	}
}

func TestClient_TempObjectKey(t *testing.T) {
	client := &Client{basePath: ""}
	if got := client.TempObjectKey("12", "a.wav"); got != "temp/12/a.wav" {
		t.Errorf("TempObjectKey() = %q, want temp/12/a.wav", got)
	}
}

func TestClient_TestObjectKey(t *testing.T) {
	client := &Client{basePath: ""}
	if got := client.TestObjectKey("main.go"); got != "test/main.go" {
		t.Errorf("TestObjectKey() = %q, want test/main.go", got)
	}
}
