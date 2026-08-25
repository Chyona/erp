// Package utils 提供字符串、时间、加密等通用工具函数。
package utils

import "time"

// FormatTime 格式化时间为标准字符串。
func FormatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

// DefaultPage 规范化分页参数，返回 page 与 pageSize。
func DefaultPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}
	return page, pageSize
}
