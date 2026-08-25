// webserver 是 HTTP API 服务入口。
package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"

	"erp/docs"
	"erp/internal/bootstrap"
	"erp/internal/config"
	v1handler "erp/internal/handler/v1"
	v2handler "erp/internal/handler/v2"
	"erp/internal/middleware"
	"erp/internal/model"
	"erp/internal/pkg/authjwt"
	"erp/internal/pkg/llm"
	"erp/internal/pkg/storage"
	"erp/internal/repository"
	"erp/internal/seeder"
	"erp/internal/service"
	routesv1 "erp/internal/routes/v1"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"
)

func main() {
	configPath := flag.String("config", "", "外部配置文件路径（可选）")
	flag.Parse()

	// 本地 backend/.env（含 APP_LLM_*），不覆盖已有环境变量
	_ = bootstrap.LoadDotEnv(".env")
	_ = bootstrap.LoadDotEnv("backend/.env")

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}
	if err := cfg.Validate(); err != nil {
		fmt.Fprintf(os.Stderr, "配置校验失败: %v\n", err)
		os.Exit(1)
	}

	logger, err := bootstrap.InitLogger(cfg.Logger)
	if err != nil {
		fmt.Fprintf(os.Stderr, "初始化日志失败: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync() //nolint:errcheck

	db, err := bootstrap.InitDatabase(cfg.Database, logger)
	if err != nil {
		logger.Fatal("初始化数据库失败", zap.Error(err))
	}

	accountRepo := repository.NewAccountRepository(db)
	accountService := service.NewAccountService(accountRepo)
	jwtManager := authjwt.NewManager(cfg.Auth.JWTSecret, cfg.Auth.ExpireHours)
	v1AccountHandler := v1handler.NewAccountHandler(accountService)
	v1AuthHandler := v1handler.NewAuthHandler(accountService, jwtManager)
	v2AccountHandler := v2handler.NewAccountHandler(accountService)

	erpRepo := repository.NewErpRepository(db)
	var storeClient *storage.Client
	if sc, err := storage.NewClientFromAppConfig(cfg.Storage); err != nil {
		logger.Warn("对象存储未就绪，附件上传不可用", zap.Error(err))
	} else {
		storeClient = sc
		logger.Info("对象存储已启用", zap.String("provider", string(sc.ProviderType())), zap.String("basePath", sc.BasePath()))
	}
	erpService := service.NewErpService(erpRepo, accountRepo, storeClient)
	erpHandler := v1handler.NewErpHandler(erpService, accountService)
	backupService := service.NewBackupService("./data/erp-backups")
	backupHandler := v1handler.NewBackupHandler(backupService, erpService, accountService)
	appService := service.NewAppService(erpRepo)
	appHandler := v1handler.NewAppHandler(appService)
	llmClient := llm.NewClient(cfg.LLM)
	importHandler := v1handler.NewImportHandler(llmClient)
	if llmClient.Enabled() {
		logger.Info("大模型已启用", zap.String("visionModel", llmClient.VisionModel()))
	} else {
		logger.Warn("未配置 APP_LLM_API_KEY，截图导入将无法使用大模型识别")
	}

	// 补齐新增列，并确保内置管理员账号存在
	if err := db.AutoMigrate(
		&model.Account{},
		&model.Voucher{},
		&model.ChartAccount{},
		&model.Attachment{},
		&model.AuditLog{},
		&model.Setting{},
	); err != nil {
		logger.Fatal("自动迁移数据库表失败", zap.Error(err))
	}
	if err := seeder.EnsureBuiltinAdmin(db, logger, cfg.Server.Mode); err != nil {
		logger.Fatal("确保内置管理员失败", zap.Error(err))
	}
	if err := seeder.EnsureAccountRoles(db, logger); err != nil {
		logger.Warn("补齐账号角色失败", zap.Error(err))
	}

	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(gin.Recovery(), middleware.SecurityHeaders(), middleware.CORS(cfg.CORSAllowList()), middleware.RequestLogger(logger))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	erpAPI := r.Group("/openapi/erp/v1")
	routesv1.RegisterRoutes(erpAPI, v1AccountHandler, v1AuthHandler, v2AccountHandler, jwtManager, accountRepo)

	erpData := erpAPI.Group("")
	erpData.Use(middleware.Auth(jwtManager, accountRepo), middleware.RequirePasswordSetupDone(), middleware.DenyReadonlyOnMutate())
	routesv1.RegisterErpRoutes(erpData, erpHandler, appHandler, importHandler, backupHandler)

	if cfg.Server.Mode != "release" {
		docs.SwaggerInfo.Host = cfg.Server.Addr()
		r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	addr := cfg.Server.Addr()
	logger.Info("HTTP 服务启动", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("HTTP 服务异常退出", zap.Error(err))
	}
}
