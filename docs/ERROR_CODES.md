# Error Codes Reference

This document catalogs domain-specific error codes returned across the Chava Fitness Club API.

---

## Customer & POS Counter Errors

| HTTP Status | Error Code | Description | Payload Additions |
|---|---|---|---|
| 409 | `CUSTOMER_PHONE_EXISTS` | A customer with this mobile number already exists in the system. | `existingCustomer`: `{ _id, name, phone, address, dueBalancePaise }` |
| 400 | `CUSTOMER_PHONE_INVALID` | Invalid mobile number format. Must be a 10-digit Indian number starting with 6, 7, 8, or 9 (Devanagari digits normalized). | - |
| 400 | `CUSTOMER_NAME_INVALID` | Customer name must be between 2 and 60 characters and contain valid letters/marks. | - |
| 400 | `CUSTOMER_ADDRESS_REQUIRED` | Address is required for quick-add operations on the POS counter. | - |
| 404 | `CUSTOMER_NOT_FOUND` | Customer with specified ID does not exist. | - |

---

## Authentication & Authorization

| HTTP Status | Error Code | Description |
|---|---|---|
| 401 | `UNAUTHORIZED` | Invalid or expired JWT token. |
| 403 | `FORBIDDEN` | Staff access attempted on an owner-only resource or action. |

---

## Billing & Returns

| HTTP Status | Error Code | Description |
|---|---|---|
| 400 | `INSUFFICIENT_STOCK` | Stock quantity is less than required billing quantity. |
| 400 | `INVALID_PAYMENT` | Total payments do not match grand total or credit limit exceeded. |
| 400 | `DISCOUNT_EXCEEDED` | Staff discount exceeds maximum allowed percentage without owner approval. |
