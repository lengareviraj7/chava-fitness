# Production Dependency License Audit

This document provides a comprehensive license audit of all production runtime dependencies utilized by the Chava Fitness Club ERP across the server and client packages.

---

## 1. Server Dependencies

| Package | Version | License | Commercial Use | Notes |
|---|---|---|---|---|
| `bcrypt` | ^5.1.1 | MIT | Permitted | Standard cryptographic password hashing |
| `cookie-parser` | ^1.4.7 | MIT | Permitted | HTTP cookie parsing middleware |
| `cors` | ^2.8.5 | MIT | Permitted | Cross-Origin Resource Sharing middleware |
| `dotenv` | ^16.4.7 | BSD-2-Clause | Permitted | Environment configuration loader |
| `express` | ^4.21.2 | MIT | Permitted | Minimalist Node.js web application framework |
| `express-rate-limit` | ^7.5.0 | MIT | Permitted | Brute-force & DoS rate-limiting middleware |
| `helmet` | ^8.0.0 | MIT | Permitted | HTTP security headers middleware |
| `jsonwebtoken` | ^9.0.2 | MIT | Permitted | JSON Web Token session signature & verification |
| `mongoose` | ^8.9.5 | MIT | Permitted | MongoDB object modeling & connection library |
| `zod` | ^3.24.1 | MIT | Permitted | TypeScript-first schema validation library |

---

## 2. Client Dependencies

| Package | Version | License | Commercial Use | Notes |
|---|---|---|---|---|
| `axios` | ^1.7.9 | MIT | Permitted | Promise-based HTTP client |
| `clsx` | ^2.1.1 | MIT | Permitted | Utility for constructing `className` strings |
| `lucide-react` | ^0.475.0 | ISC | Permitted | Clean, modern iconography |
| `react` | ^18.3.1 | MIT | Permitted | Declarative UI library |
| `react-dom` | ^18.3.1 | MIT | Permitted | DOM bindings for React |
| `react-router-dom` | ^6.28.2 | MIT | Permitted | Client-side routing library |
| `tailwind-merge` | ^2.6.0 | MIT | Permitted | Merge Tailwind CSS classes safely |
| `three` | ^0.173.0 | MIT | Permitted | 3D graphics library for dashboard hero canvas |

---

## 3. Compliance Summary
- **100% Permissive Licenses**: All production dependencies are licensed under standard permissive open-source licenses (**MIT**, **ISC**, and **BSD-2-Clause**).
- **Copyleft / Restrictive Licenses**: **ZERO** GPL, AGPL, or restrictive copyleft dependencies are utilized in production.
- **Commercial Deployment**: All libraries are fully approved for commercial retail use without licensing fees, source-code disclosure mandates, or distribution restrictions.
