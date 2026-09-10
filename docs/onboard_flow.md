# ONBOARDING FLOW — FILE GUIDE

Welcome to the onboarding flow.

This document provides a clean, at-a-glance overview of each onboarding file, the requirement it covers, and the key behavior implemented.

---

## 📁 Project Structure

The onboarding experience is split into focused screens and a mock API layer. Each file maps to a specific onboarding requirement (`ONB-*`), making the flow easy to understand, test, and maintain.

---

## 🧭 File-by-File Overview

### 1. `api/mockOnboardingApi.ts`

**Card:** `ONB-1.0`

The mock onboarding API handles the core authentication and onboarding validation logic.

**Key features:**

* OTP sending and verification
* Maximum of **3 OTP verification attempts**
* **30-second lockout** after failed attempts
* **30-second resend cooldown**
* Legal acceptance validation
* Registered phone-number checks

---

### 2. `app/splash.tsx`

**Card:** `ONB-1.1`

The splash screen is the entry point to the onboarding experience.

**Key features:**

* User must tap to proceed
* No skip option
* No guest mode

**Goal:** Ensure every user enters the required onboarding flow before accessing the application.

---

### 3. `app/phone-entry.tsx`

**Card:** `ONB-1.2`

Collects and validates the user's phone number.

**Key features:**

* Country-code picker
* Phone-number validation
* Continue button remains disabled until the number is valid

**Goal:** Prevent invalid phone numbers from progressing through onboarding.

---

### 4. `app/legal-acceptance.tsx`

**Card:** `ONB-1.3`

Handles the required legal agreements before account creation can continue.

**Key features:**

* Terms of Service acceptance
* Privacy Policy acceptance
* 16+ requirement bundled into the acceptance flow
* Backend-enforced legal acceptance

**Goal:** Ensure required legal and age requirements are acknowledged before proceeding.

---

### 5. `app/otp-entry.tsx`

**Card:** `ONB-1.4 & 1.6`

Provides the OTP verification interface.

**Key features:**

* Maximum of **3 verification attempts**
* Account/session lockout handling
* OTP resend support
* Expired-code handling
* Registered-number verification

**Goal:** Securely verify the user's phone number while providing clear failure and recovery states.

---

### 6. `app/profile-setup.tsx`

**Card:** `ONB-1.5`

Collects the minimum profile information required to complete onboarding.

**Key features:**

* Name is required
* About/bio field is required
* About/bio cannot be cleared once required
* Profile photo is optional

**Goal:** Ensure every completed profile contains the required information while keeping the photo optional.

---

### 7. `app/device-handoff.tsx`

**Card:** `ONB-1.7`

Handles account access when onboarding occurs on a new device.

**Key features:**

* Confirmation is shown only on a new device
* Existing/old devices are silently logged out

**Goal:** Maintain a single active device experience while minimizing unnecessary interruption on the previous device.

---

## 🔐 Security & Validation Summary

| Area               | Behavior                        |
| ------------------ | ------------------------------- |
| OTP attempts       | Maximum 3 attempts              |
| OTP lockout        | 30 seconds                      |
| OTP resend         | 30-second cooldown              |
| OTP expiry         | Expired codes are rejected      |
| Phone verification | Registered-number check         |
| Legal requirements | Terms + Privacy + 16+           |
| Phone validation   | Continue disabled until valid   |
| Profile            | Name + About required           |
| Profile photo      | Optional                        |
| Device security    | Old devices silently logged out |

---

## 🔄 Onboarding Flow

```text
Splash
  │
  ▼
Phone Entry
  │
  ▼
Legal Acceptance
  │
  ▼
OTP Verification
  │
  ▼
Profile Setup
  │
  ▼
Device Handoff
  │
  ▼
Onboarding Complete
```

### Flow Principles

* **No skipping:** Users must complete the required onboarding steps.
* **No guest mode:** Access requires going through the onboarding flow.
* **Validation first:** Users cannot continue until required data is valid.
* **Security by default:** OTP attempts, expiry, lockouts, and registered-number checks are enforced.
* **Legal compliance:** Required agreements are validated by the backend.
* **Minimal profile requirements:** Only essential profile information is mandatory.
* **Device protection:** Previous devices are logged out when a new device takes over.

---

## 🗂️ Quick Reference

| File                       | Requirement     | Purpose                                |
| -------------------------- | --------------- | -------------------------------------- |
| `api/mockOnboardingApi.ts` | `ONB-1.0`       | OTP, legal, and registration API logic |
| `app/splash.tsx`           | `ONB-1.1`       | Required onboarding entry              |
| `app/phone-entry.tsx`      | `ONB-1.2`       | Phone collection and validation        |
| `app/legal-acceptance.tsx` | `ONB-1.3`       | Legal and age acceptance               |
| `app/otp-entry.tsx`        | `ONB-1.4 & 1.6` | OTP verification and security          |
| `app/profile-setup.tsx`    | `ONB-1.5`       | Required profile information           |
| `app/device-handoff.tsx`   | `ONB-1.7`       | New-device confirmation and logout     |

---

## ✅ Implementation Checklist

* [ ] Splash requires explicit continuation
* [ ] Guest mode is unavailable
* [ ] Phone number validation is enforced
* [ ] Country code selection is supported
* [ ] Continue remains disabled for invalid phone numbers
* [ ] Terms of Service acceptance is required
* [ ] Privacy Policy acceptance is required
* [ ] 16+ requirement is enforced
* [ ] OTP verification supports a 3-attempt limit
* [ ] OTP lockout lasts 30 seconds
* [ ] OTP resend cooldown lasts 30 seconds
* [ ] Expired OTPs are rejected
* [ ] Registered-number checks are enforced
* [ ] Name is required
* [ ] About/bio is required
* [ ] Profile photo remains optional
* [ ] New-device confirmation is displayed when required
* [ ] Old devices are silently logged out

---

## 🎯 Requirement Coverage

The onboarding implementation covers requirements from **ONB-1.0 through ONB-1.7**, with the exception of the numbering gap represented by the combined `ONB-1.4 & 1.6` OTP screen.

Each requirement is mapped to a dedicated implementation file, keeping the onboarding flow modular, testable, and easy to maintain.

---

**Onboarding Flow • File & Requirement Guide**
