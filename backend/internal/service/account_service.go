// Package service 业务逻辑层，编排 repository 完成业务处理。
package service

import (
	"context"
	"errors"
	"net/mail"
	"strings"

	"erp/internal/model"
	"erp/internal/pkg/rbac"
	"erp/internal/pkg/utils"
	"erp/internal/repository"
	"gorm.io/gorm"
)

// UpdateAccountPatch 管理员可更新的账号字段（用户名不可改）。
type UpdateAccountPatch struct {
	Nickname *string
	Email    *string
	Phone    *string
	Remark   *string
	Role     *string
	Status   *int8
}

// AccountService 账号业务接口。
type AccountService interface {
	CreateAccount(ctx context.Context, username, email, password, nickname, role string) (*model.Account, error)
	GetAccount(ctx context.Context, id uint) (*model.Account, error)
	ListAccounts(ctx context.Context, page, pageSize int) ([]model.Account, int64, error)
	UpdateAccount(ctx context.Context, id uint, patch UpdateAccountPatch) (*model.Account, error)
	ResetPassword(ctx context.Context, id uint, newPassword string, requireReSetup bool) (*model.Account, error)
	SetupPassword(ctx context.Context, accountID uint, newPassword string) (*model.Account, error)
	SkipPasswordSetup(ctx context.Context, accountID uint) (*model.Account, error)
	ChangePassword(ctx context.Context, accountID uint, oldPassword, newPassword string) (*model.Account, error)
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
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(email)
	if username == "" {
		return nil, errors.New("请填写用户名")
	}

	if _, err := s.accountRepo.GetByUsername(ctx, username); err == nil {
		return nil, errors.New("该用户名已被使用，请换一个用户名")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if email != "" {
		if _, err := mail.ParseAddress(email); err != nil {
			return nil, errors.New("邮箱格式不正确")
		}
		if _, err := s.accountRepo.GetByEmail(ctx, email); err == nil {
			return nil, errors.New("该邮箱已被使用，请换一个邮箱")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if role == "" {
		role = rbac.RoleUser
	}
	if !rbac.IsValidRole(role) {
		return nil, errors.New("请选择有效的角色")
	}
	if len(password) < utils.MinPasswordLen {
		return nil, utils.ErrWeakPassword
	}

	hashed, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}

	account := &model.Account{
		Username:           username,
		Email:              optionalStringPtr(email),
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

func (s *accountService) UpdateAccount(ctx context.Context, id uint, patch UpdateAccountPatch) (*model.Account, error) {
	account, err := s.accountRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	builtin := rbac.IsBuiltinAdminUsername(account.Username)
	oldRole := resolveAccountRole(account)

	if builtin {
		if patch.Role != nil {
			return nil, errors.New("内置管理员账号不可修改角色")
		}
		if patch.Status != nil && *patch.Status != 1 {
			return nil, errors.New("内置管理员账号不可禁用")
		}
	}

	if patch.Nickname != nil {
		account.Nickname = strings.TrimSpace(*patch.Nickname)
	}
	if patch.Email != nil {
		email := strings.TrimSpace(*patch.Email)
		if email != "" {
			if _, err := mail.ParseAddress(email); err != nil {
				return nil, errors.New("邮箱格式不正确")
			}
			existing, err := s.accountRepo.GetByEmail(ctx, email)
			if err == nil && existing.ID != id {
				return nil, errors.New("该邮箱已被使用，请换一个邮箱")
			} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}
		account.Email = optionalStringPtr(email)
	}
	if patch.Phone != nil {
		account.Phone = strings.TrimSpace(*patch.Phone)
	}
	if patch.Remark != nil {
		account.Remark = strings.TrimSpace(*patch.Remark)
	}
	if patch.Role != nil {
		if !rbac.IsValidRole(*patch.Role) {
			return nil, errors.New("请选择有效的角色")
		}
		newRole := rbac.NormalizeRole(*patch.Role)
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
	if patch.Status != nil {
		if oldRole == rbac.RoleAdmin && *patch.Status != 1 {
			n, err := s.accountRepo.CountByRole(ctx, rbac.RoleAdmin)
			if err != nil {
				return nil, err
			}
			if n <= 1 {
				return nil, errors.New("不能禁用最后一个管理员")
			}
		}
		account.Status = *patch.Status
	}
	if err := s.accountRepo.Update(ctx, account); err != nil {
		return nil, err
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

// ResetPassword 管理员重置密码。
// requireReSetup=true 时，目标用户下次登录需重新设置密码；改自己的密码时一般为 false。
func (s *accountService) ResetPassword(ctx context.Context, id uint, newPassword string, requireReSetup bool) (*model.Account, error) {
	if len(newPassword) < utils.MinPasswordLen {
		return nil, utils.ErrWeakPassword
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
	account.MustChangePassword = requireReSetup
	if err := s.accountRepo.Update(ctx, account); err != nil {
		return nil, err
	}
	account.Role = resolveAccountRole(account)
	return account, nil
}

// ChangePassword 当前用户修改自己的密码（需验证旧密码）。
func (s *accountService) ChangePassword(ctx context.Context, accountID uint, oldPassword, newPassword string) (*model.Account, error) {
	if len(newPassword) < utils.MinPasswordLen {
		return nil, utils.ErrWeakPassword
	}
	account, err := s.accountRepo.GetByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	ok, _ := utils.CheckPassword(oldPassword, account.Password)
	if !ok {
		return nil, errors.New("当前密码不正确")
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

// SetupPassword 首次登录设置密码（仅 MustChangePassword=true 时可用）。
func (s *accountService) SetupPassword(ctx context.Context, accountID uint, newPassword string) (*model.Account, error) {
	if len(newPassword) < utils.MinPasswordLen {
		return nil, utils.ErrWeakPassword
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

// SkipPasswordSetup 放弃本次设密，继续使用当前密码进入系统。
func (s *accountService) SkipPasswordSetup(ctx context.Context, accountID uint) (*model.Account, error) {
	account, err := s.accountRepo.GetByID(ctx, accountID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("账号不存在")
		}
		return nil, err
	}
	if !account.MustChangePassword {
		account.Role = resolveAccountRole(account)
		return account, nil
	}
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
	if rbac.IsBuiltinAdminUsername(account.Username) {
		return errors.New("内置管理员账号不可删除")
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
	ok, needUpgrade := utils.CheckPassword(password, account.Password)
	if !ok {
		return nil, errors.New("用户名或密码错误")
	}
	if needUpgrade {
		if hashed, hashErr := utils.RehashPassword(password); hashErr == nil {
			account.Password = hashed
			_ = s.accountRepo.Update(ctx, account)
		}
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
	ok, _ := utils.CheckPassword(password, account.Password)
	if !ok {
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

func optionalStringPtr(raw string) *string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	return &raw
}
