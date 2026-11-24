package main

import (
	"github.com/netmon/netmon/internal/api"
	"go.uber.org/zap"
	"net/http"
	"os"
)

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer logger.Sync()
	stateFile := os.Getenv("NETMON_TARGETS_FILE")
	if stateFile == "" {
		stateFile = "data/targets.json"
	}
	localAPI, err := api.NewLocalAPI(logger, stateFile)
	if err != nil {
		logger.Fatal("Could not open local target inventory", zap.Error(err))
	}
	logger.Info("local NetMon API on 127.0.0.1:8080; scheduler disabled; TCP probes use real connections")
	if err := http.ListenAndServe("127.0.0.1:8080", localAPI.LocalHandler()); err != nil {
		logger.Fatal("API stopped", zap.Error(err))
	}
}
