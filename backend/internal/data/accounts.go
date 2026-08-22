// Package data 存放内嵌静态数据（默认科目表等）。
package data

import _ "embed"

// DefaultAccountsJSON 默认会计科目定义（JSON 数组），供应用启动初始化使用。
//
//go:embed default_accounts.json
var DefaultAccountsJSON []byte
