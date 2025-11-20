# Cron Job Examples for Automated Backups

This document provides examples for setting up automated backups using cron jobs.

## Setting Up Cron Jobs

### Via cPanel

1. Log into cPanel
2. Navigate to "Advanced" → "Cron Jobs"
3. Add the following cron jobs:

**Daily Backup (3:05 AM every day):**
```
5 3 * * * /bin/bash /home/pawnline/proton-prediction-market/scripts/backup_site.sh daily >> /home/pawnline/logs/backup.log 2>&1
```

**Weekly Backup (3:10 AM every Sunday):**
```
10 3 * * 0 /bin/bash /home/pawnline/proton-prediction-market/scripts/backup_site.sh weekly >> /home/pawnline/logs/backup.log 2>&1
```

**Monthly Backup (3:15 AM on the 1st of each month):**
```
15 3 1 * * /bin/bash /home/pawnline/proton-prediction-market/scripts/backup_site.sh monthly >> /home/pawnline/logs/backup.log 2>&1
```

### Via SSH (crontab -e)

If you have SSH access, you can edit your crontab directly:

```bash
crontab -e
```

Then add the same lines as above.

## Cron Schedule Format

```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday=0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

## Backup Retention

The backup script automatically rotates old backups:
- **Daily**: Keeps 7 most recent backups
- **Weekly**: Keeps 4 most recent backups
- **Monthly**: Keeps 3 most recent backups

## Backup Locations

Backups are stored in:
```
~/backups/proton-prediction-market/
├── daily/
│   ├── site-daily-20231120-030500.tar.gz
│   ├── site-daily-20231121-030500.tar.gz
│   └── ...
├── weekly/
│   ├── site-weekly-20231119-031000.tar.gz
│   └── ...
└── monthly/
    ├── site-monthly-20231101-031500.tar.gz
    └── ...
```

## Log Files

Backup logs are written to:
```
~/logs/backup.log
```

View recent backup activity:
```bash
tail -50 ~/logs/backup.log
```

## Manual Backup

To run a backup manually:

```bash
# Daily backup
~/proton-prediction-market/scripts/backup_site.sh daily

# Weekly backup
~/proton-prediction-market/scripts/backup_site.sh weekly

# Monthly backup
~/proton-prediction-market/scripts/backup_site.sh monthly
```

## Offsite Sync

Your office NAS can rsync the entire backup and logs directories:

```bash
# From your office NAS, run:
rsync -avz --delete pawnline@pawnline.io:~/backups/ /path/to/nas/backups/pawnline.io/
rsync -avz --delete pawnline@pawnline.io:~/logs/ /path/to/nas/logs/pawnline.io/
```

Set up a cron job on your NAS to run this hourly or daily.

## Monitoring

To check if backups are running:

```bash
# List recent backups
ls -lht ~/backups/proton-prediction-market/daily/ | head -10

# Check backup log for errors
grep -i error ~/logs/backup.log | tail -20

# Verify latest backup integrity
LATEST=$(ls -t ~/backups/proton-prediction-market/daily/*.tar.gz | head -1)
tar -tzf "$LATEST" > /dev/null && echo "OK" || echo "CORRUPT"
```

## Troubleshooting

**Backup not running:**
1. Check cron is enabled: `crontab -l`
2. Check log file: `tail ~/logs/backup.log`
3. Verify script permissions: `ls -l ~/proton-prediction-market/scripts/backup_site.sh`

**Disk space issues:**
1. Check disk usage: `du -sh ~/backups/`
2. Adjust retention settings in `backup_site.sh`
3. Ensure offsite sync is working

**Database corruption:**
- The backup script verifies database integrity
- Check logs for "integrity check failed" messages
- Corrupted backups are automatically deleted
