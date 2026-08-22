package storage

import (
	"net/url"
	"strings"
)

const (
	// DefaultBasePath 对象键默认前缀；空表示直接落在桶根下（如 attachments/...）。
	DefaultBasePath = ""

	// SubDirTemp 临时文件目录（相对 base_path），如 ASR 前上传获取公网 URL。
	SubDirTemp = "temp"
	// SubDirTest cmd/test 进程产生的测试上传目录（相对 base_path）；单元测试不受此约定约束。
	SubDirTest = "test"
	// SubDirAttachments 凭证附件目录（相对 base_path）。
	SubDirAttachments = "attachments"
)

// ResolveBasePath 规范化保存路径；空值时返回 DefaultBasePath（当前为空，即无额外前缀）。
func ResolveBasePath(path string) string {
	path = strings.Trim(path, "/")
	if path == "" {
		return DefaultBasePath
	}
	return path
}

// JoinObjectKey 将保存路径前缀与相对对象键拼接为完整对象键。
func JoinObjectKey(basePath, objectKey string) string {
	basePath = strings.Trim(basePath, "/")
	objectKey = strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	if basePath == "" {
		return objectKey
	}
	if objectKey == "" {
		return basePath
	}
	return basePath + "/" + objectKey
}

// AttachmentObjectKey 按凭证所属年/月生成附件对象键：attachments/YYYY/MM/{id}{ext}。
// 对象键与凭证字号解耦，字号变更时无需迁移 COS 对象；展示/下载名由业务层按当前凭证动态生成。
func AttachmentObjectKey(year, month, id, ext string) string {
	year = strings.TrimSpace(year)
	month = strings.TrimSpace(month)
	id = strings.TrimSpace(id)
	ext = strings.TrimSpace(ext)
	if year == "" {
		year = "unknown"
	}
	if month == "" {
		month = "00"
	}
	if len(month) == 1 {
		month = "0" + month
	}
	if ext == "" {
		ext = ".dat"
	}
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	objectName := id
	if objectName == "" {
		objectName = "file"
	}
	return JoinObjectKey(SubDirAttachments, year+"/"+month+"/"+objectName+ext)
}

// ObjectKeyFromPublicURL 从公开访问 URL 解析桶内对象键；非 http(s) 或 data: 返回空。
func ObjectKeyFromPublicURL(publicURL string) string {
	raw := strings.TrimSpace(publicURL)
	if raw == "" || strings.HasPrefix(strings.ToLower(raw), "data:") {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return ""
	}
	key := strings.TrimPrefix(u.Path, "/")
	if key == "" && u.RawPath != "" {
		if decoded, err := url.PathUnescape(strings.TrimPrefix(u.RawPath, "/")); err == nil {
			key = decoded
		}
	}
	return key
}
