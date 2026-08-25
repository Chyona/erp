// Package seeder 种子数据填充，仅由 envinit 调用。
package seeder

import (
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SeedAll 执行全部种子数据填充。
func SeedAll(db *gorm.DB, logger *zap.Logger, serverMode string) error {
	logger.Info("开始填充种子数据...")
	if err := SeedAccounts(db, logger, serverMode); err != nil {
		return err
	}
	logger.Info("种子数据填充完成")
	return nil
}
