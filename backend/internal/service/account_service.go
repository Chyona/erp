// Package service 业务逻辑层，编排 repository 完成业务处理。
package service

import (
	"context"
	"errors"
	"strings"

	"erp/internal/model"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/utils"
	"erp/internal/repository"
	"gorm.io/gorm"
)

// AccountService 账号业务接口。
type AccountService interface {
	CreateAccount(ctx context.Context, username, email, password, nickname, role string) (*model.Account, error)
	GetAccount(ctx context.Context, id uint) (*model.Account, error)
	ListAccounts(ctx context.Context, page, pageSize int) ([]model.Account, int64, error)
	UpdateAccount(ctx context.Context, id uint, nickname string, role *string, status *int8) (*model.Account, error)
	ResetPassword(ctx context.Context, id uint, newPassword string) (*model.Account, error)
	SetupPassword(ctx context.Context, accountID uint, newPassword string) (*model.Account, error)
	DeleteAccount(ctx context.Context, id uint) error
	Authenticate(ctx context.Context, username, password string) (*model.Account, error)
	VerifyPassword(ctx context.Context, accountID uint, password string) error
	CountByRole(ctx context.Context, role string) (int64, error)
}

type accountService struct {
	accountRepo repository.AccountRepository
}

// NewAccountService 创建账号业务服务实例。
func NewAccountService(accountRepo repository.AccountRepository) AccountService {
	return &accountService{accountRepo: accountRepo}
}

func (s *accountService) CreateAccount(ctx context.Context, username, email, password, nickname, role string) (*model.Account, error) {
	if _, err := s.accountRepo.GetByUsername(ctx, username); err == nil {
		return nil, errors.New("账号名已存在")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if role == "" {
		role = rbac.RoleUser
	}
	if !rbac.IsValidRole(role) {
		return nil, errors.New("无效的角色")
	}
	if len(password) < 6 {
		return nil, errors.New("密码至少 6 位")
	}

	hashed, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}

	account := &model.Account{
		Username:           username,
		Email:              email,
		Password:           hashed,
		Nickname:           nickname,
		Role:               rbac.NormalizeRole(role),
		MustChangePassword: true,
		Status:             1,
	}
	if err := s.accountRepo.Create(ctx, account); err != nil {
		return nil, err
	}
	return account, nil
}

func (s *accountService) GetAccount(ctx context.Context, id uint) (*model.Account, error) {
	account, err := s.accountRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

func (s *accountService) ListAccounts(ctx context.Context, page, pageSize int) ([]model.Account, int64, error) {
	offset := (page - 1) * pageSize
	accounts, total, err := s.accountRepo.List(ctx, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}
	for i := range accounts {
		accounts[i].Role = resolveAccountRole(&accounts[i])
	}
	return accounts, total, nil
}

func (s *accountService) UpdateAccount(ctx context.Context, id uint, nickname string, role *string, status *int8) (*model.Account, error) {
	account, err := s.accountRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	oldRole := resolveAccountRole(account)
	if nickname != "" {
		account.Nickname = nickname
	}
	if role != nil {
		if !rbac.IsValidRole(*role) {
			return nil, errors.New("无效的角色")
		}
		newRole := rbac.NormalizeRole(*role)
		if oldRole == rbac.RoleAdmin && newRole != rbac.RoleAdmin {
			n, err := s.accountRepo.CountByRole(ctx, rbac.RoleAdmin)
			if err != nil {
				return nil, err
			}
			if n <= 1 {
				return nil, errors.New("至少保留一个管理员账号")
			}
		}
		account.Role = newRole
	}
	if status != nil {
		if oldRole == rbac.RoleAdmin && *status != 1 {
			n, err := s.accountRepo.CountByRole(ctx, rbac.RoleAdmin)
			if err != nil {
				return nil, err
			}
			if n <= 1 {
				return nil, errors.New("不能禁用最后一个管理员")
			}
		}
		account.Status = *status
	}
	if err := s.accountRepo.Update(ctx, account); err != nil {
		return nil, err
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

// ResetPassword 管理员重置密码；重置后需用户下次登录重新设置。
func (s *accountService) ResetPassword(ctx context.Context, id uint, newPassword string) (*model.Account, error) {
	if len(newPassword) < 6 {
		return nil, errors.New("密码至少 6 位")
	}
	account, err := s.accountRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return nil, err
	}
	account.Password = hashed
	account.MustChangePassword = true
	if err := s.accountRepo.Update(ctx, account); err != nil {
		return nil, err
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

// SetupPassword 首次登录设置密码（仅 MustChangePassword=true 时可用）。
func (s *accountService) SetupPassword(ctx context.Context, accountID uint, newPassword string) (*model.Account, error) {
	if len(newPassword) < 6 {
		return nil, errors.New("密码至少 6 位")
	}
	account, err := s.accountRepo.GetByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	if !account.MustChangePassword {
		return nil, errors.New("当前账号无需设置密码，如需修改请联系管理员")
	}
	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return nil, err
	}
	account.Password = hashed
	account.MustChangePassword = false
	if err := s.accountRepo.Update(ctx, account); err != nil {
		return nil, err
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

func (s *accountService) DeleteAccount(ctx context.Context, id uint) error {
	account, err := s.accountRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("账号不存在")
		}
		return err
	}
	if resolveAccountRole(account) == rbac.RoleAdmin {
		n, err := s.accountRepo.CountByRole(ctx, rbac.RoleAdmin)
		if err != nil {
			return err
		}
		if n <= 1 {
			return errors.New("不能删除最后一个管理员")
		}
	}
	return s.accountRepo.Delete(ctx, id)
}

func (s *accountService) Authenticate(ctx context.Context, username, password string) (*model.Account, error) {
	account, err := s.accountRepo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户名或密码错误")
		}
		return nil, err
	}
	if account.Status != 1 {
		return nil, errors.New("账号已禁用")
	}
	if !utils.CheckPassword(password, account.Password) {
		return nil, errors.New("用户名或密码错误")
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

func (s *accountService) VerifyPassword(ctx context.Context, accountID uint, password string) error {
	account, err := s.accountRepo.GetByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("账号不存在")
		}
		return err
	}
	if !utils.CheckPassword(password, account.Password) {
		return errors.New("密码不正确")
	}
	return nil
}

func (s *accountService) CountByRole(ctx context.Context, role string) (int64, error) {
	return s.accountRepo.CountByRole(ctx, rbac.NormalizeRole(role))
}

// resolveAccountRole 规范化角色；历史 admin 用户在角色为空时视为管理员。
func resolveAccountRole(account *model.Account) string {
	raw := strings.TrimSpace(account.Role)
	if raw == "" && account.Username == "admin" {
		return rbac.RoleAdmin
	}
	return rbac.NormalizeRole(raw)
}
