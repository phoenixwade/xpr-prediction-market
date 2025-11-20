# Backup and Logging System

This document describes the automated backup and comprehensive logging system for the Proton Prediction Market platform.

## Overview

The system provides:
- **Automated rotating backups** of database, images, .env, and API files
- **Comprehensive API logging** for debugging and monitoring
- **Deployment logging** for tracking deployments
- **Easy recovery** from catastrophic failures

## Logging System

### API Logs

All API requests and operations are logged to `~/logs/api.log` with detailed context.

**Location:** `~/logs/api.log`

**What's logged:**
- All HTTP requests (GET, POST, DELETE)
- .env file parsing and path resolution
- Admin authentication checks
- Database operations (success and failures)
- All errors with full context

**Log format:**
```
[2023-11-20 15:30:45] [INFO] [GET /api/comments.php?market_id=104] [192.168.1.1] Comments fetched successfully | Context: {"market_id":104,"count":3,"admins_count":2}
```

**Viewing logs:**
```bash
# View recent API activity
tail -50 ~/logs/api.log

# Watch logs in real-time
tail -f ~/logs/api.log

# Search for errors
grep -i error ~/logs/api.log | tail -20

# Search for specific user activity
grep "phoenixwade" ~/logs/api.log

# View admin authorization attempts
grep "admin" ~/logs/api.log
```

### Deployment Logs

All deployments are logged to `~/logs/deploy.log`.

**Location:** `~/logs/deploy.log`

**What's logged:**
- Git commit being deployed
- Node.js and npm versions
- Environment variables extracted
- Build success/failure
- Deployment size and file count

**Viewing logs:**
```bash
# View recent deployments
tail -50 ~/logs/deploy.log

# Check last deployment
tail -20 ~/logs/deploy.log

# Find failed deployments
grep -i error ~/logs/deploy.log
```

## Backup System

### What's Backed Up

1. **SQLite Database** (`~/public_html/data/comments.db`)
   - Backed up using sqlite3 `.backup` command
   - Integrity verified after backup

2. **Uploaded Images** (`~/public_html/images/`)
   - All user-uploaded market thumbnails

3. **Environment File** (`~/proton-prediction-market/.env`)
   - Contains all configuration and secrets

4. **API Files** (`~/public_html/api/`)
   - PHP endpoints (comments.php, upload.php, logger.php)

5. **Configuration** (`~/public_html/.htaccess`)
   - Apache configuration for React Router

6. **Metadata**
   - Git commit hash
   - Timestamp
   - File counts and sizes

### Backup Types and Retention

| Type | Schedule | Retention | Location |
|------|----------|-----------|----------|
| Daily | 3:05 AM daily | 7 backups | `~/backups/proton-prediction-market/daily/` |
| Weekly | 3:10 AM Sundays | 4 backups | `~/backups/proton-prediction-market/weekly/` |
| Monthly | 3:15 AM 1st of month | 3 backups | `~/backups/proton-prediction-market/monthly/` |

### Setting Up Automated Backups

See [scripts/CRON_EXAMPLES.md](scripts/CRON_EXAMPLES.md) for detailed cron setup instructions.

**Quick setup via cPanel:**
1. Log into cPanel → Advanced → Cron Jobs
2. Add these three cron jobs:

```
5 3 * * * /bin/bash /home/pawnline/proton-prediction-market/scripts/backup_site.sh daily >> /home/pawnline/logs/backup.log 2>&1
10 3 * * 0 /bin/bash /home/pawnline/proton-prediction-market/scripts/backup_site.sh weekly >> /home/pawnline/logs/backup.log 2>&1
15 3 1 * * /bin/bash /home/pawnline/proton-prediction-market/scripts/backup_site.sh monthly >> /home/pawnline/logs/backup.log 2>&1
```

### Manual Backup

Run a backup manually at any time:

```bash
# Daily backup
~/proton-prediction-market/scripts/backup_site.sh daily

# Weekly backup
~/proton-prediction-market/scripts/backup_site.sh weekly

# Monthly backup
~/proton-prediction-market/scripts/backup_site.sh monthly
```

### Backup Structure

Each backup is a compressed tar.gz archive containing:

```
site-daily-20231120-030500.tar.gz
└── .tmp-20231120-030500/
    ├── comments.20231120-030500.db  # Database snapshot
    ├── images/                       # All uploaded images
    ├── api/                          # PHP API files
    ├── .env                          # Environment configuration
    ├── .htaccess                     # Apache config (if present)
    ├── manifest.json                 # Backup metadata
    └── git-commit.txt                # Git commit hash
```

## Recovery Procedures

### Full System Recovery

If you experience a catastrophic failure, follow these steps:

1. **List available backups:**
```bash
ls -lht ~/backups/proton-prediction-market/daily/
```

2. **Run the restore script:**
```bash
~/proton-prediction-market/scripts/restore_site.sh ~/backups/proton-prediction-market/daily/site-daily-YYYYMMDD-HHMMSS.tar.gz
```

3. **Follow the prompts:**
   - Review the manifest
   - Confirm restore
   - Choose whether to restore API files and .htaccess

4. **Verify the restore:**
```bash
# Test comments API
curl -s 'https://pawnline.io/api/comments.php?market_id=104' | python3 -m json.tool

# Check image count
ls -l ~/public_html/images/ | wc -l

# Visit the site
# Open https://pawnline.io in browser
```

5. **Redeploy if needed:**
```bash
cd ~/proton-prediction-market
git checkout <commit-from-manifest>
./deploy-to-cpanel.sh
```

### Partial Recovery

**Recover only the database:**
```bash
# Extract backup
tar -xzf ~/backups/proton-prediction-market/daily/site-daily-YYYYMMDD-HHMMSS.tar.gz -C /tmp/

# Find and copy database
DB=$(find /tmp/.tmp-* -name "comments.*.db" | head -1)
cp "$DB" ~/public_html/data/comments.db
chmod 640 ~/public_html/data/comments.db
```

**Recover only images:**
```bash
# Extract backup
tar -xzf ~/backups/proton-prediction-market/daily/site-daily-YYYYMMDD-HHMMSS.tar.gz -C /tmp/

# Copy images
rsync -a /tmp/.tmp-*/images/ ~/public_html/images/
```

**Recover only .env:**
```bash
# Extract backup
tar -xzf ~/backups/proton-prediction-market/daily/site-daily-YYYYMMDD-HHMMSS.tar.gz -C /tmp/

# Copy .env
cp /tmp/.tmp-*/.env ~/proton-prediction-market/.env
chmod 640 ~/proton-prediction-market/.env
```

## Offsite Backups

Your office NAS should rsync the backup and log directories regularly:

**From your office NAS:**
```bash
# Sync backups (hourly or daily)
rsync -avz --delete pawnline@pawnline.io:~/backups/ /nas/backups/pawnline.io/

# Sync logs (daily)
rsync -avz --delete pawnline@pawnline.io:~/logs/ /nas/logs/pawnline.io/
```

**Set up cron on NAS:**
```
# Hourly backup sync
0 * * * * rsync -avz --delete pawnline@pawnline.io:~/backups/ /nas/backups/pawnline.io/ >> /nas/logs/rsync.log 2>&1

# Daily log sync
5 0 * * * rsync -avz --delete pawnline@pawnline.io:~/logs/ /nas/logs/pawnline.io/ >> /nas/logs/rsync.log 2>&1
```

## Monitoring and Maintenance

### Check Backup Health

```bash
# List recent backups
ls -lht ~/backups/proton-prediction-market/daily/ | head -10

# Check backup log for errors
grep -i error ~/logs/backup.log | tail -20

# Verify latest backup integrity
LATEST=$(ls -t ~/backups/proton-prediction-market/daily/*.tar.gz | head -1)
tar -tzf "$LATEST" > /dev/null && echo "Backup OK" || echo "Backup CORRUPT"

# Check disk space
du -sh ~/backups/
df -h ~
```

### Log Rotation

Logs will grow over time. Set up log rotation:

**Create `/home/pawnline/logrotate.conf`:**
```
/home/pawnline/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 pawnline pawnline
}
```

**Add to cron:**
```
0 0 * * * /usr/sbin/logrotate /home/pawnline/logrotate.conf
```

## Troubleshooting

### Backup Issues

**Problem: Backups not running**
- Check cron: `crontab -l`
- Check logs: `tail ~/logs/backup.log`
- Verify permissions: `ls -l ~/proton-prediction-market/scripts/backup_site.sh`
- Test manually: `~/proton-prediction-market/scripts/backup_site.sh daily`

**Problem: Database integrity check fails**
- Check database: `sqlite3 ~/public_html/data/comments.db "PRAGMA integrity_check;"`
- Review backup log for errors
- Try manual backup to isolate issue

**Problem: Disk space full**
- Check usage: `du -sh ~/backups/`
- Adjust retention in `scripts/backup_site.sh`
- Ensure offsite sync is working
- Clean old backups manually if needed

### Logging Issues

**Problem: Logs not appearing**
- Check directory exists: `ls -ld ~/logs/`
- Check permissions: `ls -l ~/logs/`
- Test logger: Access API and check `~/logs/api.log`
- Verify logger.php is deployed: `ls -l ~/public_html/api/logger.php`

**Problem: Logs too large**
- Set up log rotation (see above)
- Archive old logs: `gzip ~/logs/api.log.old`
- Adjust log level if needed

## Security Notes

- Backups are stored with `umask 077` (owner-only access)
- Backup directory permissions are `700`
- .env file contains secrets - never expose backups publicly
- Offsite backups should use SSH keys for authentication
- Log files may contain sensitive data - protect access

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/backup_site.sh` | Automated backup script |
| `scripts/restore_site.sh` | Restore from backup |
| `scripts/CRON_EXAMPLES.md` | Cron job setup examples |
| `frontend/public/api/logger.php` | Logging utility |
| `frontend/public/api/comments.php` | Comments API (with logging) |
| `deploy-to-cpanel.sh` | Deployment script (with logging) |
| `~/logs/api.log` | API request logs |
| `~/logs/deploy.log` | Deployment logs |
| `~/logs/backup.log` | Backup operation logs |
| `~/backups/proton-prediction-market/` | Backup storage |
