// Package rbac 定义账号角色与操作权限判断。
package rbac

import "strings"

const (
	RoleAdmin    = "admin"
	RoleUser     = "user"
	RoleReadonly = "readonly"

	// BuiltinAdminUsername 内置超级管理员用户名（不可删除/降权/禁用）。
	BuiltinAdminUsername = "admin"
)

// IsBuiltinAdminUsername 是否为内置超级管理员账号名。
func IsBuiltinAdminUsername(username string) bool {
	return strings.TrimSpace(username) == BuiltinAdminUsername
}

// NormalizeRole 规范化角色；空或未知时返回普通用户。
func NormalizeRole(role string) string {
	switch strings.TrimSpace(role) {
	case RoleAdmin, RoleUser, RoleReadonly:
		return strings.TrimSpace(role)
	default:
		return RoleUser
	}
}

// IsValidRole 是否为已知角色。
func IsValidRole(role string) bool {
	switch strings.TrimSpace(role) {
	case RoleAdmin, RoleUser, RoleReadonly:
		return true
	default:
		return false
	}
}

// Actor 当前登录主体。
type Actor struct {
	AccountID uint
	Username  string
	Nickname  string
	Role      string
}

// DisplayName 展示名：优先昵称，否则用户名。
func (a *Actor) DisplayName() string {
	if a == nil {
		return ""
	}
	if name := strings.TrimSpace(a.Nickname); name != "" {
		return name
	}
	return strings.TrimSpace(a.Username)
}

func (a *Actor) IsAdmin() bool {
	return a != nil && NormalizeRole(a.Role) == RoleAdmin
}

func (a *Actor) IsReadonly() bool {
	return a != nil && NormalizeRole(a.Role) == RoleReadonly
}

func (a *Actor) IsUser() bool {
	return a != nil && NormalizeRole(a.Role) == RoleUser
}

// CanWrite 是否允许写操作（只读用户不可写）。
func (a *Actor) CanWrite() bool {
	return a != nil && !a.IsReadonly()
}

// CanManageUsers 是否可管理账号。
func (a *Actor) CanManageUsers() bool {
	return a.IsAdmin()
}

// CanApprove 是否可审核/反审核。
func (a *Actor) CanApprove() bool {
	return a.IsAdmin()
}

// CanAdminOps 结转/结项/导入/恢复/改设置等管理员操作。
func (a *Actor) CanAdminOps() bool {
	return a.IsAdmin()
}

// CanExport 是否可导出/备份（只读不可）。
func (a *Actor) CanExport() bool {
	return a != nil && !a.IsReadonly()
}

// CanMutateVoucher 是否可改/删该凭证（按归属与状态）。
// createdBy==0 的历史数据仅管理员可改。
func (a *Actor) CanMutateVoucher(createdBy uint, status string) bool {
	if a == nil || a.IsReadonly() {
		return false
	}
	if a.IsAdmin() {
		return true
	}
	// 普通用户：仅自己的草稿
	if createdBy == 0 || createdBy != a.AccountID {
		return false
	}
	return status == "draft" || status == ""
}

// CanCreateVoucher 是否可录凭证。
func (a *Actor) CanCreateVoucher() bool {
	return a != nil && (a.IsAdmin() || a.IsUser())
}
