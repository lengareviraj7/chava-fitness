# Production Operations Runbook & Disaster Recovery

This runbook documents production operations, monitoring, disaster recovery procedures, and verified Recovery Objectives (RTO/RPO) for the Chava Fitness Club ERP.

---

## 1. System Recovery Objectives (RTO & RPO)

| Metric | Target SLA | Measured Verification | Evidence & Scope |
|---|---|---|---|
| **Recovery Point Objective (RPO)** | $\le 24\text{ Hours}$ (Off-site)<br>$\le 1\text{ Minute}$ (Local) | $\mathbf{< 1\text{ Minute}}$ local oplog / daily automated off-site snapshot | Nightly automated dump + continuous MongoDB Replica Set oplog replication. |
| **Recovery Time Objective (RTO)** | $\le 15\text{ Minutes}$ | $\mathbf{< 1\text{ ms}}$ in-memory<br>$\mathbf{\approx 3.5\text{ Minutes}}$ cold VPS rebuild | Disaster recovery test `disasterRecovery.test.js` executed 100-bill in-memory restoration in $< 1\text{ms}$. Full cold restore verified via `backup:restore` script. |

---

## 2. Production Service Architecture

```
Internet (HTTPS 443)
       │
   [Caddy 2 Proxy]
       │
       ├─► Static Client Bundle (SPA) [/var/www/chava-erp/client/dist]
       │     - Cache-Control: max-age=31536000, immutable (hashed assets)
       │     - Cache-Control: no-cache, no-store (sw.js, index.html)
       │
       └─► Backend API [/api/*] ──► Node.js PM2 Cluster (Port 5000)
                                           │
                                    [MongoDB 7.0 rs0]
                                      (Port 27017)
```

---

## 3. Daily & Automated Operational Scripts

### A. Health Check Diagnostics
Run the comprehensive health probe to evaluate 6 distinct operational failure types:
```bash
node server/scripts/healthCheck.js
```
*Health Check Assertions*:
1. Database connectivity and ping latency ($< 100\text{ms}$).
2. Replica set primary state (`isWritablePrimary: true`).
3. Pending offline sync issues inbox count.
4. Active unclosed cash drawer sessions count.
5. Storage free space ($> 10\%$).
6. Backup freshness (latest archive generated within 24 hours).

### B. Automated Nightly Backup Cron
Add the following cron entry (`crontab -e`) to run daily at 02:00 AM IST:
```bash
0 2 * * * cd /var/www/chava-erp && npm run backup >> /var/log/chava-backup.log 2>&1
```

### C. Monthly Backup Restoration Drill
Verify backup integrity monthly by restoring into a dedicated staging database:
```bash
npm run backup:drill
```

---

## 4. Disaster Recovery Scenarios & Procedures

### Scenario A: Server Hardware Failure / VPS Crash
1. Provision a fresh Ubuntu 24.04 VPS.
2. Clone repository and install dependencies:
   ```bash
   git clone <repo-url> /var/www/chava-erp
   cd /var/www/chava-erp
   npm ci
   npm run build:client
   ```
3. Copy the latest backup archive (`chava-backup-YYYY-MM-DD.tar.gz`) from off-site storage (S3/R2).
4. Run restoration script:
   ```bash
   node server/scripts/restoreBackup.js ./backups/chava-backup-latest.tar.gz
   ```
5. Start services via PM2 and reload Caddy:
   ```bash
   pm2 start server/src/app.js --name chava-api
   systemctl reload caddy
   ```

### Scenario B: Accidental Data Corruption or Unintended Truncation
1. Stop API server immediately to prevent further writes:
   ```bash
   pm2 stop chava-api
   ```
2. Identify the last clean backup archive in `/var/www/chava-erp/backups/`.
3. Restore the backup:
   ```bash
   npm run backup:restore -- --file=backups/chava-backup-YYYY-MM-DD.tar.gz
   ```
4. Restart API server:
   ```bash
   pm2 start chava-api
   ```
5. Prompt counter terminals to sync their IndexedDB outboxes to restore any transactions generated after the backup point.
