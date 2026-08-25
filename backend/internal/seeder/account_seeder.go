package seeder

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"erp/internal/model"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/utils"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	builtinAdminUsername = "admin"
	builtinAdminEmail    = "admin@example.com"
	builtinAdminNickname = "管理员"
	devAdminPassword     = "ChangeMe1!"
)

func resolveInitialAdminPassword(serverMode string) (string, error) {
	if fromEnv := strings.TrimSpace(os.Getenv("APP_ADMIN_INITIAL_PASSWORD")); fromEnv != "" {
		if len(fromEnv) < utils.MinPasswordLen {
			return "", fmt.Errorf("APP_ADMIN_INITIAL_PASSWORD 至少 %d 位", utils.MinPasswordLen)
		}
		return fromEnv, nil
	}
	if serverMode == "release" {
		return "", errors.New("生产环境须设置 APP_ADMIN_INITIAL_PASSWORD（至少 8 位）")
	}
	return devAdminPassword, nil
}

// SeedAccounts 填充默认账号种子数据（保证内置 admin 存在）。
func SeedAccounts(db *gorm.DB, logger *zap.Logger, serverMode string) error {
	if err := EnsureBuiltinAdmin(db, logger, serverMode); err != nil {
		return err
	}
	return EnsureAccountRoles(db, logger)
}

// EnsureBuiltinAdmin 确保系统内置管理员账号存在。
// 新建时使用 APP_ADMIN_INITIAL_PASSWORD（生产必填）；已存在则不覆盖密码。
func EnsureBuiltinAdmin(db *gorm.DB, logger *zap.Logger, serverMode string) error {
	var account model.Account
	err := db.Unscoped().Where("username = ?", builtinAdminUsername).First(&account).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		initialPassword, pwdErr := resolveInitialAdminPassword(serverMode)
		if pwdErr != nil {
			return pwdErr
		}
		hashed, hashErr := utils.HashPassword(initialPassword)
		if hashErr != nil {
			return hashErr
		}
		account = model.Account{
			Username:           builtinAdminUsername,
			Email:              strPtr(builtinAdminEmail),
			Password:           hashed,
			Nickname:           builtinAdminNickname,
			Role:               rbac.RoleAdmin,
			MustChangePassword: true,
			Status:             1,
		}
		if createErr := db.Create(&account).Error; createErr != nil {
			return createErr
		}
		logger.Info("已创建内置管理员账号",
			zap.String("username", builtinAdminUsername),
			zap.Bool("must_change_password", true),
		)
		if serverMode != "release" {
			logger.Warn("开发环境默认管理员初始密码见 APP_ADMIN_INITIAL_PASSWORD 或内置 dev 默认值，首次登录须修改")
		}
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
			"status": 1,
			"role":   rbac.RoleAdmin,
		})
	if res.Error != nil {
		return res.Error
	}
	return nil
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
