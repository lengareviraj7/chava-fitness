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

---

## One-Step Purchase & Inward Stock

| HTTP Status | Error Code | Description | Hindi Draft | Marathi Draft |
|---|---|---|---|---|
| 409 | `PRODUCT_EXISTS` | Brand + product name already exists in this category. | यह उत्पाद ब्रांड और नाम पहले से मौजूद है। | हे प्रॉडक्ट ब्रँड आणि नावासह आधीच अस्तित्वात आहे. |
| 409 | `BARCODE_EXISTS` | Barcode is already assigned to another variant. | यह बारकोड पहले से किसी अन्य प्रकार को दिया गया है। | हा बारकोड आधीच इतर व्हेरियंटला दिला गेला आहे. |
| 409 | `SKU_EXISTS` | Auto-generated or provided SKU collides. | यह SKU पहले से मौजूद है। | हा SKU आधीच अस्तित्वात आहे. |
| 400 | `GST_RATE_REQUIRED` | New product must have an explicitly chosen GST rate from allowed list. | नए उत्पाद के लिए जीएसटी दर चुनना अनिवार्य है। | नवीन प्रॉडक्टसाठी जीएसटी दर निवडणे अनिवार्य आहे. |
| 400 | `EXPIRY_IN_PAST` | Provided batch expiry date is in the past. | एक्सपायरी तिथि पिछली तारीख की नहीं हो सकती। | एक्सपायरी तारीख भूतकाळातील असू शकत नाही. |
| 400 | `EXPIRY_FORMAT_INVALID` | Invalid expiry format. Must be MM/YYYY. | अमान्य एक्सपायरी प्रारूप (MM/YYYY होना चाहिए)। | अवैध एक्सपायरी फॉरमॅट (MM/YYYY असावे). |
| 400 | `SELLING_PRICE_ABOVE_MRP` | Selling price cannot exceed MRP. | बिक्री मूल्य एमआरपी से अधिक नहीं हो सकता। | विक्री किंमत एमआरपीपेक्षा जास्त असू शकत नाही. |
| 400 | `NEW_PRODUCT_INVALID` | Validation failure in new product fields. | नए उत्पाद की जानकारी अमान्य है। | नवीन प्रॉडक्टची माहिती अवैध आहे. |
| 400 | `TEMP_REFERENCE_INVALID` | Inward line refers to an unknown temporary variant ID. | अस्थायी व्हेरियंट संदर्भ अमान्य है। | तात्पुरता व्हेरियंट संदर्भ अवैध आहे. |
