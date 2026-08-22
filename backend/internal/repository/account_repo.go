// Package repository 数据访问层，封装 GORM 数据库操作。
package repository

import (
	"context"

	"erp/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AccountRepository 账号数据访问接口。
type AccountRepository interface {
	Create(ctx context.Context, account *model.Account) error
	GetByID(ctx context.Context, id uint) (*model.Account, error)
	GetByUsername(ctx context.Context, username string) (*model.Account, error)
	GetByEmail(ctx context.Context, email string) (*model.Account, error)
	List(ctx context.Context, offset, limit int) ([]model.Account, int64, error)
	Update(ctx context.Context, account *model.Account) error
	Delete(ctx context.Context, id uint) error
	CountByRole(ctx context.Context, role string) (int64, error)
}

type accountRepository struct {
	db *gorm.DB
}

// NewAccountRepository 创建账号仓储实例。
func NewAccountRepository(db *gorm.DB) AccountRepository {
	return &accountRepository{db: db}
}

func (r *accountRepository) Create(ctx context.Context, account *model.Account) error {
	return r.db.WithContext(ctx).Create(account).Error
}

func (r *accountRepository) GetByID(ctx context.Context, id uint) (*model.Account, error) {
	var account model.Account
	err := r.db.WithContext(ctx).First(&account, id).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *accountRepository) GetByUsername(ctx context.Context, username string) (*model.Account, error) {
	var account model.Account
	err := r.db.WithContext(ctx).Where("username = ?", username).First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *accountRepository) GetByEmail(ctx context.Context, email string) (*model.Account, error) {
	var account model.Account
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&account).Error
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *accountRepository) List(ctx context.Context, offset, limit int) ([]model.Account, int64, error) {
	var accounts []model.Account
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Account{})
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	// 内置 admin 置顶，其余按 id 降序（新账号在前）
	if err := query.Offset(offset).Limit(limit).
		Order(clause.Expr{SQL: "CASE WHEN username = ? THEN 0 ELSE 1 END", Vars: []interface{}{"admin"}}).
		Order("id DESC").
		Find(&accounts).Error; err != nil {
		return nil, 0, err
	}
	return accounts, total, nil
}

func (r *accountRepository) Update(ctx context.Context, account *model.Account) error {
	return r.db.WithContext(ctx).Save(account).Error
}

func (r *accountRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.Account{}, id).Error
}

func (r *accountRepository) CountByRole(ctx context.Context, role string) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).Model(&model.Account{}).Where("role = ?", role).Count(&total).Error
	return total, err
}
