#!/bin/bash
# Linux/Unix cron setup for daily DPI monitoring
# Run this script to setup daily automatic testing

echo "========================================"
echo "DPI Daily Monitoring - Cron Setup"
echo "========================================"
echo

SCRIPT_DIR="/d/kilo/daily_tests"
ORCHESTRATOR="$SCRIPT_DIR/daily_orchestrator.py"
CRON_TIME="0 3 * * *"  # 3:00 AM daily

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found"
    echo "Please install Python 3"
    exit 1
fi

# Check if script exists
if [ ! -f "$ORCHESTRATOR" ]; then
    echo "ERROR: Orchestrator script not found at $ORCHESTRATOR"
    exit 1
fi

echo "Installing cron job..."
echo "Schedule: Daily at 3:00 AM"
echo "Script: $ORCHESTRATOR"
echo

# Create cron entry
CRON_CMD="$CRON_TIME cd $SCRIPT_DIR && python3 $ORCHESTRATOR >> $SCRIPT_DIR/cron.log 2>&1"

# Check if entry already exists
if crontab -l 2>/dev/null | grep -q "daily_orchestrator.py"; then
    echo "Cron job already exists. Updating..."
    # Remove old entry
    crontab -l 2>/dev/null | grep -v "daily_orchestrator.py" | crontab -
fi

# Add new entry
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

if [ $? -eq 0 ]; then
    echo
    echo "========================================"
    echo "SUCCESS: Cron job installed!"
    echo "========================================"
    echo
    echo "The DPI monitoring suite will run daily at 3:00 AM"
    echo
    echo "To view installed cron jobs: crontab -l"
    echo "To edit: crontab -e"
    echo "To view logs: cat $SCRIPT_DIR/cron.log"
    echo "To manually run: cd $SCRIPT_DIR && python3 $ORCHESTRATOR"
    echo
else
    echo
    echo "ERROR: Failed to install cron job"
    echo
fi
