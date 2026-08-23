// Package usermsg 将技术性错误文案转成用户可读的中文提示。
package usermsg

import (
	"regexp"
	"strings"
)

var (
	reSQLState     = regexp.MustCompile(`(?i)SQLSTATE\s*\d+`)
	reGinField     = regexp.MustCompile(`(?i)Field validation for '([^']+)' failed on the '([^']+)' tag`)
	reDuplicateKey = regexp.MustCompile(`(?i)duplicate key value violates unique constraint "([^"]+)"`)
)

var fieldLabel = map[string]string{
	"Username": "用户名",
	"Email":    "邮箱",
	"Password": "密码",
	"Nickname": "昵称",
	"Role":     "角色",
	"Status":   "状态",
}

// FromError 将 error 转为面向用户的中文提示。
func FromError(err error) string {
	if err == nil {
		return "操作失败"
	}
	return Sanitize(err.Error())
}

// Sanitize 将原始错误/接口文案转为用户可读提示；已是通顺中文则尽量保留。
func Sanitize(raw string) string {
	msg := strings.TrimSpace(raw)
	if msg == "" {
		return "操作失败，请稍后重试"
	}

	lower := strings.ToLower(msg)

	// —— 唯一约束 ——
	if m := reDuplicateKey.FindStringSubmatch(msg); len(m) == 2 {
		name := strings.ToLower(m[1])
		switch {
		case strings.Contains(name, "email"):
			return "该邮箱已被使用，请换一个邮箱"
		case strings.Contains(name, "username"):
			return "该用户名已被使用，请换一个用户名"
		default:
			return "数据与已有记录冲突，请检查是否填写重复"
		}
	}
	if strings.Contains(lower, "duplicate") && strings.Contains(lower, "email") {
		return "该邮箱已被使用，请换一个邮箱"
	}
	if strings.Contains(lower, "duplicate") && strings.Contains(lower, "username") {
		return "该用户名已被使用，请换一个用户名"
	}
	if strings.Contains(lower, "idx_account_email") {
		return "该邮箱已被使用，请换一个邮箱"
	}
	if strings.Contains(lower, "idx_account_username") {
		return "该用户名已被使用，请换一个用户名"
	}
	if strings.Contains(lower, "23505") || strings.Contains(lower, "unique constraint") {
		return "数据与已有记录冲突，请检查是否填写重复"
	}

	// —— Gin / validator ——
	if m := reGinField.FindStringSubmatch(msg); len(m) == 3 {
		field := fieldLabel[m[1]]
		if field == "" {
			field = m[1]
		}
		switch m[2] {
		case "required":
			if strings.EqualFold(m[1], "Email") {
				return "操作失败，请稍后重试"
			}
			return "请填写" + field
		case "email":
			return "邮箱格式不正确"
		case "min":
			if strings.EqualFold(m[1], "Password") {
				return "密码至少 6 位"
			}
			return field + "长度不够"
		default:
			return field + "填写有误，请检查后重试"
		}
	}
	if strings.Contains(lower, "invalid character") || strings.Contains(lower, "cannot unmarshal") {
		return "提交的数据格式不正确，请检查后重试"
	}
	if strings.Contains(lower, "eof") && strings.Contains(lower, "json") {
		return "请填写完整信息后再提交"
	}

	// —— 网络 / 数据库底层 ——
	if strings.Contains(lower, "connection refused") ||
		strings.Contains(lower, "connect: ") ||
		strings.Contains(lower, "no such host") ||
		strings.Contains(lower, "i/o timeout") {
		return "无法连接服务器，请稍后重试或联系管理员"
	}
	if reSQLState.MatchString(msg) ||
		strings.Contains(lower, "pq:") ||
		strings.HasPrefix(lower, "error:") ||
		strings.Contains(lower, "sqlstate") {
		return "操作失败，请稍后重试；若反复出现请联系管理员"
	}

	// —— JWT / 鉴权英文 ——
	if strings.Contains(lower, "token is expired") || strings.Contains(lower, "expired") && strings.Contains(lower, "token") {
		return "登录已过期，请重新登录"
	}
	if strings.Contains(lower, "invalid token") || strings.Contains(lower, "unexpected signing") {
		return "登录状态无效，请重新登录"
	}

	// —— HTTP 原始状态 ——
	if strings.HasPrefix(lower, "http ") {
		return "请求失败，请稍后重试"
	}

	// 含明显技术栈痕迹时，不原样展示
	if looksTechnical(msg) {
		return "操作失败，请稍后重试；若反复出现请联系管理员"
	}

	return msg
}

func looksTechnical(msg string) bool {
	lower := strings.ToLower(msg)
	markers := []string{
		"sqlstate", "goroutine", "stack trace", "panic:",
		"runtime error", "null pointer", "undefined:",
		"econnrefused", "enotfound", "etimedout",
		"statuscode", "traceback",
	}
	for _, m := range markers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	// 英文技术句且几乎无中文
	hasHan := false
	for _, r := range msg {
		if r >= 0x4e00 && r <= 0x9fff {
			hasHan = true
			break
		}
	}
	if !hasHan && (strings.Contains(lower, "failed") || strings.Contains(lower, "error") || strings.Contains(lower, "exception")) {
		return true
	}
	return false
}
