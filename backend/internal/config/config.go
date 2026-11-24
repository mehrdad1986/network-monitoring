package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	Redis      RedisConfig
	Probe      ProbeConfig
	Logging    LoggingConfig
	Ollama     OllamaConfig
	Git        GitConfig
	RangeCheck RangeCheckConfig
	Export     ExportConfig
}

type ServerConfig struct {
	Host         string
	Port         int
	Mode         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
	MaxConns int
	MinConns int
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type ProbeConfig struct {
	ID       string
	Name     string
	Location string
	APIKey   string
	ServerURL string
	HeartbeatInterval time.Duration
}

type LoggingConfig struct {
	Level  string
	Format string
}

type OllamaConfig struct {
	Enabled        bool
	Host           string
	Model          string
	TimeoutSeconds int
}

type GitConfig struct {
	Enabled bool
	Remote  string
	Branch  string
}

type RangeCheckConfig struct {
	Enabled         bool
	CSVPath         string
	IntervalSeconds int
	Location        string
}

type ExportConfig struct {
	DataDir       string
	RetentionDays int
}

func Load(configPath string) (*Config, error) {
	v := viper.New()

	// Set defaults
	setDefaults(v)

	// Read config file if provided
	if configPath != "" {
		v.SetConfigFile(configPath)
		if err := v.ReadInConfig(); err != nil {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
	}

	// Override with environment variables
	v.AutomaticEnv()
	v.SetEnvPrefix("NETMON")

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}

func setDefaults(v *viper.Viper) {
	// Server defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.mode", "release")
	v.SetDefault("server.readtimeout", 30*time.Second)
	v.SetDefault("server.writetimeout", 30*time.Second)

	// Database defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "netmon")
	v.SetDefault("database.password", "")
	v.SetDefault("database.database", "netmon")
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("database.maxconns", 25)
	v.SetDefault("database.minconns", 5)

	// Redis defaults
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.password", "")
	v.SetDefault("redis.db", 0)

	// Probe defaults
	v.SetDefault("probe.heartbeatinterval", 30*time.Second)

	// Logging defaults
	v.SetDefault("logging.level", "info")
	v.SetDefault("logging.format", "json")

	// Ollama defaults
	v.SetDefault("ollama.enabled", false)
	v.SetDefault("ollama.host", "http://localhost:11434")
	v.SetDefault("ollama.model", "hermes3")
	v.SetDefault("ollama.timeoutseconds", 180)

	// Git defaults
	v.SetDefault("git.enabled", false)
	v.SetDefault("git.remote", "origin")
	v.SetDefault("git.branch", "main")

	// Range check defaults
	v.SetDefault("rangecheck.enabled", false)
	v.SetDefault("rangecheck.csvpath", "ranges.csv")
	v.SetDefault("rangecheck.intervalseconds", 600)
	v.SetDefault("rangecheck.location", "US")

	// Export defaults
	v.SetDefault("export.datadir", "data")
	v.SetDefault("export.retentiondays", 7)
}

func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Database, c.SSLMode,
	)
}
