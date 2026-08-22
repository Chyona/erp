package seeder

import (
	"errors"

	"erp/internal/model"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/utils"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	builtinAdminUsername = "admin"
	builtinAdminPassword = "admin"
	builtinAdminEmail    = "admin@example.com"
	builtinAdminNickname = "管理员"
)

// SeedAccounts 填充默认账号种子数据（保证内置 admin 存在）。
func SeedAccounts(db *gorm.DB, logger *zap.Logger) error {
	if err := EnsureBuiltinAdmin(db, logger); err != nil {
		return err
	}
	return EnsureAccountRoles(db, logger)
}

// EnsureBuiltinAdmin 确保系统内置管理员账号存在。
// 若不存在则创建 username=admin / password=admin；已存在则仅补齐角色与启用状态，不覆盖已改密码。
func EnsureBuiltinAdmin(db *gorm.DB, logger *zap.Logger) error {
	var account model.Account
	err := db.Unscoped().Where("username = ?", builtinAdminUsername).First(&account).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		hashed, hashErr := utils.HashPassword(builtinAdminPassword)
		if hashErr != nil {
			return hashErr
		}
		account = model.Account{
			Username:           builtinAdminUsername,
			Email:              builtinAdminEmail,
			Password:           hashed,
			Nickname:           builtinAdminNickname,
			Role:               rbac.RoleAdmin,
			MustChangePassword: false,
			Status:             1,
		}
		if createErr := db.Create(&account).Error; createErr != nil {
			return createErr
		}
		logger.Info("已创建内置管理员账号",
			zap.String("username", builtinAdminUsername),
			zap.String("password", builtinAdminPassword),
		)
		return nil
	}

	changed := false
	if account.DeletedAt.Valid {
		account.DeletedAt = gorm.DeletedAt{}
		changed = true
	}
	if account.Role != rbac.RoleAdmin {
		account.Role = rbac.RoleAdmin
		changed = true
	}
	if account.Status != 1 {
		account.Status = 1
		changed = true
	}
	if account.MustChangePassword {
		account.MustChangePassword = false
		changed = true
	}
	if account.Nickname == "" {
		account.Nickname = builtinAdminNickname
		changed = true
	}
	if changed {
		if saveErr := db.Unscoped().Save(&account).Error; saveErr != nil {
			return saveErr
		}
		logger.Info("已修复内置管理员账号状态", zap.String("username", builtinAdminUsername))
	}
	return nil
}

// EnsureAccountRoles 为旧账号补齐角色：admin 用户 → 管理员，其余空角色 → 普通用户。
func EnsureAccountRoles(db *gorm.DB, logger *zap.Logger) error {
	res := db.Model(&model.Account{}).
		Where("username = ? AND (role IS NULL OR role = '')", builtinAdminUsername).
		Update("role", rbac.RoleAdmin)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		logger.Info("已将 admin 账号角色补齐为管理员", zap.Int64("count", res.RowsAffected))
	}

	res = db.Model(&model.Account{}).
		Where("role IS NULL OR role = ''").
		Update("role", rbac.RoleUser)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		logger.Info("已将空角色账号补齐为普通用户", zap.Int64("count", res.RowsAffected))
	}

	res = db.Model(&model.Account{}).
		Where("username = ?", builtinAdminUsername).
		Updates(map[string]interface{}{
			"must_change_password": false,
			"status":               1,
			"role":                 rbac.RoleAdmin,
		})
	if res.Error != nil {
		return res.Error
	}
	return nil
}
