// Package config 负责加载应用配置，支持 embed 内嵌配置与外部文件路径。
package config

import (
	"embed"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/viper"
)

//go:embed config.yaml
var embeddedConfig embed.FS

// Config 应用全局配置结构体，字段与 config.yaml 一一对应。
type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Logger   LoggerConfig   `mapstructure:"logger"`
	Storage  StorageConfig  `mapstructure:"storage"`
	LLM      LLMConfig      `mapstructure:"llm"`
	Auth     AuthConfig     `mapstructure:"auth"`
}

// ServerConfig HTTP 服务相关配置。
type ServerConfig struct {
	Host        string   `mapstructure:"host"`
	Port        int      `mapstructure:"port"`
	Mode        string   `mapstructure:"mode"`
	CORSOrigins []string `mapstructure:"cors_origins"`
}

// AuthConfig 登录 JWT 配置。
type AuthConfig struct {
	JWTSecret   string `mapstructure:"jwt_secret"`
	ExpireHours int    `mapstructure:"expire_hours"`
}

// DatabaseConfig PostgreSQL 数据库连接配置。
type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	SSLMode      string `mapstructure:"sslmode"`
	Timezone     string `mapstructure:"timezone"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
}

// LoggerConfig 日志输出配置。
type LoggerConfig struct {
	Level      string `mapstructure:"level"`
	Format     string `mapstructure:"format"`
	Filename   string `mapstructure:"filename"`
	MaxSize    int    `mapstructure:"max_size"`    // 单个日志文件最大体积（MB）
	MaxBackups int    `mapstructure:"max_backups"` // 最多保留的历史日志文件数量
}

// StorageConfig 对象存储配置，对应 config.yaml 的 storage 段。
type StorageConfig struct {
	BasePath            string           `mapstructure:"base_path"`
	SignedURLExpireDays int              `mapstructure:"signed_url_expire_days"`
	COS                 COSStorageConfig `mapstructure:"cos"`
	OSS                 OSSStorageConfig `mapstructure:"oss"`
	TOS                 TOSStorageConfig `mapstructure:"tos"`
}

// COSStorageConfig 腾讯云 COS 配置。
type COSStorageConfig struct {
	SecretID   string `mapstructure:"secret_id"`
	SecretKey  string `mapstructure:"secret_key"`
	BucketName string `mapstructure:"bucket_name"`
	Region     string `mapstructure:"region"`
}

// OSSStorageConfig 阿里云 OSS 配置。
type OSSStorageConfig struct {
	AccessKeyID     string `mapstructure:"access_key_id"`
	AccessKeySecret string `mapstructure:"access_key_secret"`
	BucketName      string `mapstructure:"bucket_name"`
	Endpoint        string `mapstructure:"endpoint"`
}

// TOSStorageConfig 火山引擎 TOS 配置。
type TOSStorageConfig struct {
	AccessKeyID     string `mapstructure:"access_key_id"`
	AccessKeySecret string `mapstructure:"access_key_secret"`
	BucketName      string `mapstructure:"bucket_name"`
	Region          string `mapstructure:"region"`
	Endpoint        string `mapstructure:"endpoint"`
}

// LLMConfig OpenAI 兼容大模型（DashScope 等），环境变量前缀 APP_LLM_*。
type LLMConfig struct {
	APIKey      string `mapstructure:"api_key"`
	BaseURL     string `mapstructure:"base_url"`
	Model       string `mapstructure:"model"`
	FlashModel  string `mapstructure:"flash_model"`
	VisionModel string `mapstructure:"vision_model"`
}

// DSN 生成 PostgreSQL 连接字符串。
func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode, d.Timezone,
	)
}

// Addr 返回 HTTP 监听地址。
func (s ServerConfig) Addr() string {
	return fmt.Sprintf("%s:%d", s.Host, s.Port)
}

// Load 加载配置。
// 优先级：环境变量 > 外部配置文件（-config）> 内嵌 config.yaml。
func Load(configPath string) (*Config, error) {
	v := viper.New()
	v.SetEnvPrefix("APP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if configPath != "" {
		v.SetConfigFile(configPath)
		if err := v.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("读取外部配置文件失败: %w", err)
		}
	} else {
		v.SetConfigType("yaml")
		data, err := embeddedConfig.ReadFile("config.yaml")
		if err != nil {
			return nil, fmt.Errorf("读取内嵌配置文件失败: %w", err)
		}
		if err := v.ReadConfig(strings.NewReader(string(data))); err != nil {
			return nil, fmt.Errorf("解析内嵌配置文件失败: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("反序列化配置失败: %w", err)
	}

	applyEnvOverrides(&cfg)
	return &cfg, nil
}

const defaultJWTSecret = "erp-dev-jwt-secret-change-me"

// Validate 校验生产环境必填项。
func (c *Config) Validate() error {
	mode := strings.TrimSpace(c.Server.Mode)
	secret := strings.TrimSpace(c.Auth.JWTSecret)
	if mode == "release" {
		if secret == "" || secret == defaultJWTSecret || len(secret) < 32 {
			return fmt.Errorf("生产环境须设置至少 32 位的 APP_AUTH_JWT_SECRET")
		}
	}
	return nil
}

// CORSAllowList 返回允许的跨域 Origin 列表。
func (c *Config) CORSAllowList() []string {
	out := make([]string, 0, len(c.Server.CORSOrigins))
	for _, origin := range c.Server.CORSOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			out = append(out, origin)
		}
	}
	return out
}

// applyEnvOverrides 用已设置的环境变量覆盖配置（仅当环境变量存在时生效）。
func applyEnvOverrides(cfg *Config) {
	if val, ok := os.LookupEnv("SERVER_HOST"); ok {
		cfg.Server.Host = val
	}
	if val, ok := os.LookupEnv("SERVER_PORT"); ok {
		if port, err := strconv.Atoi(val); err == nil {
			cfg.Server.Port = port
		}
	}
	if val, ok := os.LookupEnv("SERVER_MODE"); ok {
		cfg.Server.Mode = val
	}
	if val, ok := os.LookupEnv("APP_CORS_ORIGINS"); ok {
		cfg.Server.CORSOrigins = splitCSV(val)
	} else if val, ok := os.LookupEnv("CORS_ORIGINS"); ok {
		cfg.Server.CORSOrigins = splitCSV(val)
	}

	if val, ok := os.LookupEnv("DATABASE_HOST"); ok {
		cfg.Database.Host = val
	}
	if val, ok := os.LookupEnv("DATABASE_PORT"); ok {
		if port, err := strconv.Atoi(val); err == nil {
			cfg.Database.Port = port
		}
	}
	if val, ok := os.LookupEnv("DATABASE_USER"); ok {
		cfg.Database.User = val
	}
	if val, ok := os.LookupEnv("DATABASE_PASSWORD"); ok {
		cfg.Database.Password = val
	}
	if val, ok := os.LookupEnv("DATABASE_DBNAME"); ok {
		cfg.Database.DBName = val
	}
	if val, ok := os.LookupEnv("DATABASE_SSLMODE"); ok {
		cfg.Database.SSLMode = val
	}
	if val, ok := os.LookupEnv("DATABASE_TIMEZONE"); ok {
		cfg.Database.Timezone = val
	}
	if val, ok := os.LookupEnv("DATABASE_MAX_IDLE_CONNS"); ok {
		if n, err := strconv.Atoi(val); err == nil {
			cfg.Database.MaxIdleConns = n
		}
	}
	if val, ok := os.LookupEnv("DATABASE_MAX_OPEN_CONNS"); ok {
		if n, err := strconv.Atoi(val); err == nil {
			cfg.Database.MaxOpenConns = n
		}
	}

	if val, ok := os.LookupEnv("LOGGER_LEVEL"); ok {
		cfg.Logger.Level = val
	}
	if val, ok := os.LookupEnv("LOGGER_FORMAT"); ok {
		cfg.Logger.Format = val
	}
	if val, ok := os.LookupEnv("LOGGER_FILENAME"); ok {
		cfg.Logger.Filename = val
	}
	if val, ok := os.LookupEnv("LOGGER_MAX_SIZE"); ok {
		if n, err := strconv.Atoi(val); err == nil {
			cfg.Logger.MaxSize = n
		}
	}
	if val, ok := os.LookupEnv("LOGGER_MAX_BACKUPS"); ok {
		if n, err := strconv.Atoi(val); err == nil {
			cfg.Logger.MaxBackups = n
		}
	}

	if val, ok := os.LookupEnv("STORAGE_BASE_PATH"); ok {
		cfg.Storage.BasePath = val
	}
	if val, ok := os.LookupEnv("STORAGE_SIGNED_URL_EXPIRE_DAYS"); ok {
		if n, err := strconv.Atoi(val); err == nil {
			cfg.Storage.SignedURLExpireDays = n
		}
	}

	if val, ok := os.LookupEnv("COS_SECRET_ID"); ok {
		cfg.Storage.COS.SecretID = val
	}
	if val, ok := os.LookupEnv("COS_SECRET_KEY"); ok {
		cfg.Storage.COS.SecretKey = val
	}
	if val, ok := os.LookupEnv("COS_BUCKET_NAME"); ok {
		cfg.Storage.COS.BucketName = val
	}
	if val, ok := os.LookupEnv("COS_REGION"); ok {
		cfg.Storage.COS.Region = val
	}

	if val, ok := os.LookupEnv("OSS_ACCESS_KEY_ID"); ok {
		cfg.Storage.OSS.AccessKeyID = val
	}
	if val, ok := os.LookupEnv("OSS_ACCESS_KEY_SECRET"); ok {
		cfg.Storage.OSS.AccessKeySecret = val
	}
	if val, ok := os.LookupEnv("OSS_BUCKET_NAME"); ok {
		cfg.Storage.OSS.BucketName = val
	}
	if val, ok := os.LookupEnv("OSS_ENDPOINT"); ok {
		cfg.Storage.OSS.Endpoint = val
	}

	if val, ok := os.LookupEnv("TOS_ACCESS_KEY_ID"); ok {
		cfg.Storage.TOS.AccessKeyID = val
	}
	if val, ok := os.LookupEnv("TOS_ACCESS_KEY_SECRET"); ok {
		cfg.Storage.TOS.AccessKeySecret = val
	}
	if val, ok := os.LookupEnv("TOS_BUCKET_NAME"); ok {
		cfg.Storage.TOS.BucketName = val
	}
	if val, ok := os.LookupEnv("TOS_REGION"); ok {
		cfg.Storage.TOS.Region = val
	}
	if val, ok := os.LookupEnv("TOS_ENDPOINT"); ok {
		cfg.Storage.TOS.Endpoint = val
	}

	// APP_LLM_*（与用户提供的环境变量名一致）
	if val, ok := os.LookupEnv("APP_LLM_API_KEY"); ok {
		cfg.LLM.APIKey = val
	}
	if val, ok := os.LookupEnv("APP_LLM_BASE_URL"); ok {
		cfg.LLM.BaseURL = val
	}
	if val, ok := os.LookupEnv("APP_LLM_MODEL"); ok {
		cfg.LLM.Model = val
	}
	if val, ok := os.LookupEnv("APP_LLM_FLASH_MODEL"); ok {
		cfg.LLM.FlashModel = val
	}
	if val, ok := os.LookupEnv("APP_LLM_VISION_MODEL"); ok {
		cfg.LLM.VisionModel = val
	}

	if val, ok := os.LookupEnv("APP_AUTH_JWT_SECRET"); ok {
		cfg.Auth.JWTSecret = val
	}
	if val, ok := os.LookupEnv("APP_AUTH_EXPIRE_HOURS"); ok {
		if n, err := strconv.Atoi(val); err == nil {
			cfg.Auth.ExpireHours = n
		}
	}
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
