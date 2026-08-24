package model

// BackupRecord 服务端备份索引条目。
type BackupRecord struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
	Size      int64  `json:"size"`
	Source    string `json:"source"` // manual | upload
}
