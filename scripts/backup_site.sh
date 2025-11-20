#!/bin/bash
set -euo pipefail


BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HOME_DIR="${HOME:-/home/$(whoami)}"

BACKUP_ROOT="$HOME_DIR/backups/proton-prediction-market"
LOG_DIR="$HOME_DIR/logs"
WORK_DIR="$BACKUP_ROOT/.tmp-$TIMESTAMP"
PUBLIC_HTML="$HOME_DIR/public_html"
REPO_DIR="$HOME_DIR/proton-prediction-market"

DAILY_RETENTION=7
WEEKLY_RETENTION=4
MONTHLY_RETENTION=3

umask 077
mkdir -p "$BACKUP_ROOT"/{daily,weekly,monthly}
mkdir -p "$LOG_DIR"
mkdir -p "$WORK_DIR"

LOG_FILE="$LOG_DIR/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Starting $BACKUP_TYPE backup ==="

if [ ! -d "$PUBLIC_HTML" ]; then
    log "ERROR: public_html directory not found at $PUBLIC_HTML"
    exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
    log "ERROR: Repository directory not found at $REPO_DIR"
    exit 1
fi

log "Backing up database..."
DB_PATH="$PUBLIC_HTML/data/comments.db"
if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".timeout 5000" ".backup '$WORK_DIR/comments.$TIMESTAMP.db'"
    
    INTEGRITY=$(sqlite3 "$WORK_DIR/comments.$TIMESTAMP.db" "PRAGMA integrity_check;" 2>&1)
    if [ "$INTEGRITY" != "ok" ]; then
        log "ERROR: Database backup integrity check failed: $INTEGRITY"
        rm -rf "$WORK_DIR"
        exit 1
    fi
    log "Database backup verified (integrity: ok)"
else
    log "WARNING: Database not found at $DB_PATH, skipping"
fi

log "Backing up uploaded images..."
if [ -d "$PUBLIC_HTML/images" ]; then
    rsync -a "$PUBLIC_HTML/images/" "$WORK_DIR/images/"
    IMAGE_COUNT=$(find "$WORK_DIR/images" -type f | wc -l)
    log "Backed up $IMAGE_COUNT image files"
else
    log "WARNING: Images directory not found, skipping"
    mkdir -p "$WORK_DIR/images"
fi

log "Backing up .env file..."
if [ -f "$REPO_DIR/.env" ]; then
    cp "$REPO_DIR/.env" "$WORK_DIR/.env"
    log ".env file backed up"
else
    log "WARNING: .env file not found at $REPO_DIR/.env"
fi

log "Backing up API files..."
if [ -d "$PUBLIC_HTML/api" ]; then
    rsync -a "$PUBLIC_HTML/api/" "$WORK_DIR/api/"
    log "API files backed up"
else
    log "WARNING: API directory not found, skipping"
fi

if [ -f "$PUBLIC_HTML/.htaccess" ]; then
    cp "$PUBLIC_HTML/.htaccess" "$WORK_DIR/.htaccess"
    log ".htaccess backed up"
fi

log "Creating backup metadata..."
GIT_COMMIT="unknown"
if [ -d "$REPO_DIR/.git" ]; then
    GIT_COMMIT=$(cd "$REPO_DIR" && git rev-parse HEAD 2>/dev/null || echo "unknown")
fi

cat > "$WORK_DIR/manifest.json" <<EOF
{
  "backup_type": "$BACKUP_TYPE",
  "timestamp": "$TIMESTAMP",
  "git_commit": "$GIT_COMMIT",
  "hostname": "$(hostname)",
  "user": "$(whoami)",
  "files": {
    "database": "$([ -f "$WORK_DIR/comments.$TIMESTAMP.db" ] && stat -c%s "$WORK_DIR/comments.$TIMESTAMP.db" 2>/dev/null || echo 0)",
    "images": "$IMAGE_COUNT",
    "env": "$([ -f "$WORK_DIR/.env" ] && echo "present" || echo "missing")",
    "api": "$([ -d "$WORK_DIR/api" ] && echo "present" || echo "missing")"
  }
}
EOF

echo "$GIT_COMMIT" > "$WORK_DIR/git-commit.txt"

log "Creating compressed archive..."
ARCHIVE_NAME="site-$BACKUP_TYPE-$TIMESTAMP.tar.gz"
ARCHIVE_PATH="$BACKUP_ROOT/$BACKUP_TYPE/$ARCHIVE_NAME"

tar -czf "$ARCHIVE_PATH" -C "$BACKUP_ROOT" ".tmp-$TIMESTAMP"
ARCHIVE_SIZE=$(stat -c%s "$ARCHIVE_PATH" 2>/dev/null)
log "Archive created: $ARCHIVE_NAME (${ARCHIVE_SIZE} bytes)"

rm -rf "$WORK_DIR"

log "Rotating old backups..."
case "$BACKUP_TYPE" in
    daily)
        RETENTION=$DAILY_RETENTION
        ;;
    weekly)
        RETENTION=$WEEKLY_RETENTION
        ;;
    monthly)
        RETENTION=$MONTHLY_RETENTION
        ;;
    *)
        log "ERROR: Invalid backup type: $BACKUP_TYPE"
        exit 1
        ;;
esac

cd "$BACKUP_ROOT/$BACKUP_TYPE"
BACKUP_COUNT=$(ls -1 site-$BACKUP_TYPE-*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$RETENTION" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - RETENTION))
    ls -1t site-$BACKUP_TYPE-*.tar.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
    log "Removed $REMOVE_COUNT old backup(s), keeping $RETENTION most recent"
else
    log "Retention: $BACKUP_COUNT/$RETENTION backups"
fi

log "=== Backup completed successfully ==="
log ""

exit 0
