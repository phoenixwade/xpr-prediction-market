#!/bin/bash
set -euo pipefail


if [ $# -ne 1 ]; then
    echo "Usage: $0 <path-to-backup.tar.gz>"
    echo "Example: $0 ~/backups/proton-prediction-market/daily/site-daily-20231120-120000.tar.gz"
    exit 1
fi

BACKUP_ARCHIVE="$1"
HOME_DIR="${HOME:-/home/$(whoami)}"
RESTORE_TMP="$HOME_DIR/restore_tmp"
PUBLIC_HTML="$HOME_DIR/public_html"
REPO_DIR="$HOME_DIR/proton-prediction-market"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

if [ ! -f "$BACKUP_ARCHIVE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_ARCHIVE"
    exit 1
fi

echo "=== Proton Prediction Market Restore ==="
echo "Backup: $BACKUP_ARCHIVE"
echo ""

rm -rf "$RESTORE_TMP"
mkdir -p "$RESTORE_TMP"

echo "Extracting backup..."
tar -xzf "$BACKUP_ARCHIVE" -C "$RESTORE_TMP"

EXTRACTED_DIR=$(find "$RESTORE_TMP" -maxdepth 1 -type d -name ".tmp-*" | head -n 1)
if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERROR: Could not find extracted backup directory"
    rm -rf "$RESTORE_TMP"
    exit 1
fi

if [ -f "$EXTRACTED_DIR/manifest.json" ]; then
    echo ""
    echo "=== Backup Manifest ==="
    cat "$EXTRACTED_DIR/manifest.json"
    echo ""
fi

if [ -f "$EXTRACTED_DIR/git-commit.txt" ]; then
    GIT_COMMIT=$(cat "$EXTRACTED_DIR/git-commit.txt")
    echo "Git commit: $GIT_COMMIT"
    echo ""
fi

DB_FILE=$(find "$EXTRACTED_DIR" -name "comments.*.db" | head -n 1)
if [ -n "$DB_FILE" ]; then
    echo "Verifying database integrity..."
    INTEGRITY=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;" 2>&1)
    if [ "$INTEGRITY" != "ok" ]; then
        echo "ERROR: Database integrity check failed: $INTEGRITY"
        rm -rf "$RESTORE_TMP"
        exit 1
    fi
    echo "✓ Database integrity verified"
else
    echo "WARNING: No database found in backup"
fi

echo ""
read -p "Do you want to proceed with restore? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    rm -rf "$RESTORE_TMP"
    exit 0
fi

echo ""
echo "Backing up current live files..."
LIVE_BACKUP="$HOME_DIR/public_html_backup_$TIMESTAMP"
mkdir -p "$LIVE_BACKUP"

if [ -d "$PUBLIC_HTML/data" ]; then
    cp -r "$PUBLIC_HTML/data" "$LIVE_BACKUP/"
    echo "✓ Current database backed up to $LIVE_BACKUP/data"
fi

if [ -d "$PUBLIC_HTML/images" ]; then
    cp -r "$PUBLIC_HTML/images" "$LIVE_BACKUP/"
    echo "✓ Current images backed up to $LIVE_BACKUP/images"
fi

if [ -d "$PUBLIC_HTML/api" ]; then
    cp -r "$PUBLIC_HTML/api" "$LIVE_BACKUP/"
    echo "✓ Current API files backed up to $LIVE_BACKUP/api"
fi

echo ""
echo "Restoring database..."
if [ -n "$DB_FILE" ]; then
    mkdir -p "$PUBLIC_HTML/data"
    cp "$DB_FILE" "$PUBLIC_HTML/data/comments.db"
    chmod 640 "$PUBLIC_HTML/data/comments.db"
    echo "✓ Database restored"
fi

echo "Restoring images..."
if [ -d "$EXTRACTED_DIR/images" ]; then
    mkdir -p "$PUBLIC_HTML/images"
    rsync -a "$EXTRACTED_DIR/images/" "$PUBLIC_HTML/images/"
    IMAGE_COUNT=$(find "$PUBLIC_HTML/images" -type f | wc -l)
    echo "✓ Restored $IMAGE_COUNT image files"
fi

echo "Restoring .env..."
if [ -f "$EXTRACTED_DIR/.env" ]; then
    cp "$EXTRACTED_DIR/.env" "$REPO_DIR/.env"
    chmod 640 "$REPO_DIR/.env"
    echo "✓ .env restored"
fi

if [ -d "$EXTRACTED_DIR/api" ]; then
    read -p "Restore API files? (yes/no): " RESTORE_API
    if [ "$RESTORE_API" = "yes" ]; then
        rsync -a "$EXTRACTED_DIR/api/" "$PUBLIC_HTML/api/"
        echo "✓ API files restored"
    else
        echo "Skipped API files restore"
    fi
fi

if [ -f "$EXTRACTED_DIR/.htaccess" ]; then
    read -p "Restore .htaccess? (yes/no): " RESTORE_HTACCESS
    if [ "$RESTORE_HTACCESS" = "yes" ]; then
        cp "$EXTRACTED_DIR/.htaccess" "$PUBLIC_HTML/.htaccess"
        echo "✓ .htaccess restored"
    else
        echo "Skipped .htaccess restore"
    fi
fi

rm -rf "$RESTORE_TMP"

echo ""
echo "=== Restore Complete ==="
echo "Live backup saved to: $LIVE_BACKUP"
echo ""
echo "Verification steps:"
echo "1. Test comments API: curl -s 'https://pawnline.io/api/comments.php?market_id=104' | python3 -m json.tool"
echo "2. Check image count: ls -l ~/public_html/images/ | wc -l"
echo "3. Visit site: https://pawnline.io"
echo ""
echo "If you restored from a different git commit, redeploy:"
echo "  cd ~/proton-prediction-market && git checkout $GIT_COMMIT && ./deploy-to-cpanel.sh"
echo ""

exit 0
