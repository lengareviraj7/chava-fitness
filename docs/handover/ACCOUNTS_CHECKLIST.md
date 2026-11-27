# Accounts, Credentials & Service Registry

This document serves as the master registry of all external accounts, infrastructure services, and hardware assets for Chava Fitness Club ERP. Keep this document up to date whenever service credentials, API keys, or operational contacts change.

---

## 1. Hosting & Server Infrastructure

| Item | Service / Provider | Account / Identifier | Admin Email / Contact | Notes |
|---|---|---|---|---|
| **Domain Name** | Cloudflare / Namecheap | `chavafitness.in` *(example)* | `owner@chavafitness.in` | DNS points to VPS public IP |
| **Cloud VPS / Server** | Hetzner / DigitalOcean / AWS | 4 vCPU, 8GB RAM Ubuntu 24.04 | `root` / SSH key | Runs Node.js, Caddy, MongoDB |
| **Reverse Proxy** | Caddy 2 | Automatic Let's Encrypt SSL | Port 80/443 | Automatic HTTPS renewal |
| **Database** | MongoDB Community / Atlas | Port 27017 (Replica Set `rs0`) | `dbadmin` | Daily backups enabled |
| **Off-site Backup Storage**| Cloudflare R2 / AWS S3 | Bucket: `chava-erp-backups` | IAM Service Account | Encrypted tarballs uploaded daily |

---

## 2. Shop Identity & Legal Filings

| Item | Value / Identifier | Registered In |
|---|---|---|
| **Shop Legal Name** | Chava Fitness Club & Supplement Retail | GST Registration Certificate |
| **GSTIN** | `27AAAAA0000A1Z5` *(example)* | Government GST Portal |
| **State Code** | 27 (Maharashtra) | Legal Tax Jurisdiction |
| **Shop Address** | Main Market Road, Pune, Maharashtra | Printed on all invoices & receipts |
| **Shop Contact Phone** | `+91 98765 43210` | Printed on receipt header |
| **Owner Contact Email** | `chavafitness@gmail.com` | Primary notifications & CA reports |

---

## 3. Hardware & POS Assets

| Device ID | Location / Counter | Serial / MAC Address | Device Series | Offline Enabled |
|---|---|---|---|---|
| **DEV-01** | Counter 1 (Main Cashier) | `F4:D1:08:XX:XX:01` | Series A (`PS/2627/A...`) | Enabled |
| **DEV-02** | Counter 2 (Secondary) | `F4:D1:08:XX:XX:02` | Series B (`PS/2627/B...`) | Enabled |
| **DEV-03** | Floor Tablet (Staff Advice) | `E0:B4:79:XX:XX:03` | Series C (`PS/2627/C...`) | Disabled |
| **PRN-01** | Thermal Printer (Counter 1)| TVS RP-3200 Plus | USB 80mm | ESC/POS Auto-Cutter |
| **SCN-01** | 2D Barcode Scanner | Honeywell Voyager 1400g | USB HID Keyboard Mode | Auto-Enter Suffix |

---

## 4. Key Operational Contacts

- **Chartered Accountant (CA)**: Handling monthly GSTR-1 & GSTR-3B filings.
- **Hardware Maintenance Provider**: Thermal printer paper rolls, scanner calibration.
- **Internet Service Provider (ISP)**: Primary broadband and secondary 4G backup router.
