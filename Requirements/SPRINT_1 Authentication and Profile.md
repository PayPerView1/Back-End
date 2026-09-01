###    SPRINT 1: AUTHENTICATION AND PROFILE MANAGEMENT

#### Overview and Primary Objective

    Sprint 1 establishes the fundamental identity, authentication, and user profile management infrastructure required for all subsequent system interactions. The primary objective of Sprint 1 is to deploy a secure, stateless token-based authentication subsystem and provide complete user profile lifecycle capabilities with account type selection and email verification.

#### Allocated Functional Requirements

The following functional requirements are strictly committed for complete implementation, unit testing, and integration during Sprint 1:

- R0.01 (Create an Account): The system shall provide a registration mechanism allowing prospective users to create an account using a unique email address and a password that complies with configured complexity policies.
- R0.02 (Log In): The system shall validate user credentials against stored encrypted hashes. Upon successful verification, the system shall generate and issue cryptographically signed JSON Web Tokens (JWT) for stateless request authorization.
- R0.03 (Choose Account Type): During registration, the system shall allow users to select their account type: (a) Brand/Advertiser or (b) Content Creator/Clipper.
- R0.04 (Set Up Profile): The system shall allow users to complete their profile information, including: full name, profile picture (or brand logo), email address, phone number, and country/city.
- R0.05 (Update Profile): The system shall allow authenticated users to modify their profile information at any time (name, picture, phone number, email address, and country).
- R0.06 (Change Password): The system shall allow authenticated users to change their password by entering their current password and then their new password, confirming it, and verifying that it matches and complies with security policies.
- R0.07 (Password Reset): The system shall allow users to request password resetting via their registered email address. The system shall generate a single-use, time-limited token allowing the user to securely update their credentials.

* R0.08 (Log Out): The system shall allow users to log out of their account, with the session being securely terminated.
* R0.09 (Email Verification): Upon registering with an email address, the system shall send an activation link to the registered email. The user cannot use the account until activation is complete.

#### User Story Backlog Headlines

**US-AUTH-01:** User Self-Registration (Traces to R0.01, R0.03, R0.09)
*    "As a new user, I want to create an account using my email and password and select my account type so that I can securely log into the application and access role-specific features."*
**Story ID:** **US-AUTH-01 **
**Traces to:** **R0.01, R0.03, R0.09**
**Priority:** High
**Sprint:** **Sprint 1**
**User Story**
    As a new user, I want to create an account using my email address, a secure password, and my preferred account type (Brand or Content Creator), so that I can verify my email and securely access the platform according to my assigned role.

**Scenarios**
**Scenario 1 (Happy Path)**
1\. User enters a unique email, a password meeting complexity policy, and selects account type (Brand/Advertiser or Content Creator/Clipper).
2\. System hashes the password and creates the account in an "Unverified" state.
3\. System sends a single-use activation link to the registered email.
4\. User clicks the link within the valid window; account status changes to "Active."
5\. User is redirected to complete their profile.
**Scenario 2 (Duplicate Email)**
1\. User attempts to register with an email already on file.
2\. System rejects the request and shows "This email is already registered — log in or reset your password."
**Scenario 3 (Weak Password**
1\. User submits a password that fails the complexity policy (length, character mix).
2\. System rejects the submission and displays the specific unmet policy rule(s).
**Scenario 4 (Expired/Reused Activation Link)**
1\. User clicks an activation link after it has expired or already been used.
2\. System shows "Link expired" and offers to resend a new activation email.


**Acceptance Criteria**
\- Registration requires: unique email, password (validated against complexity policy), and account type selection.
\- Passwords shall be stored using a secure salted hashing algorithm and shall never be stored in plaintext.
\- Account remains in "Unverified" state and cannot log in until the activation link is used.
\- Activation link is single-use and time-limited; expired/used links are rejected with a resend option.
\- Duplicate email registration is blocked with a clear, actionable message.

**Team Members & Responsibilities**

| **Role Responsibilities ** |                                                                          |
| -------------------------- | ------------------------------------------------------------------------ |
| **UX/UI Designer **        | Design registration screens, flows, validation states, email templates   |
| **Frontend Developer **    | Implement registration form, validation, API integration, routing        |
| **Backend Developer **     | Implement registration API, password hashing, email service, activation  |

---

**US-AUTH-02**: Account Login and Session Creation (Traces to R0.02, R0.08)
**Story ID: US-AUTH-02**
**Requirements: R0.01, R0.03, R0.09**
**Priority: High**
**Sprint: sprint 1**
**User Story**
*    User story: "As a registered user, I want to log in with my credentials so that I can obtain access to my protected dashboard, and log out securely when done."*
**Scenarios**
 **Scenario 1: (Happy path-Successfull Login):**
 -User enters a valid email \ username and password.
 -User clicks the Login button.
 -System verifies the credentials.
-User then enters the Dashboard and can access all features.

**Scenario 2: (Invalid username or password):**
-User opens the login page and enters invalid username or password.
-User clicks the login button.
-System rejects the login request.
-System displays an “Invalid username or password” message.
-User remains in the login page.

**Scenario 3: (Empty required fields):**
-User opens the login page and leaves the email \ username or password field empty.
-User clicks the Login button.
\- System highlights the required fields.
\- System displays a validation message asking the user to complete the missing information.
**Scenario 4: (Successfull Log Out)**
**     **- User is logged into the system.
\- User clicks the Log Out button.
\- System ends the current session.
\- System redirects the user to the login page and prevents him from accessing the dashboard and features.

      **Scenario 5: (Unauthorized Access Without Login)**
       - User is not logged into the system.
       - User tries to open the protected dashboard directly.
       - System blocks access to the dashboard.
       - System redirects the user to the login page.
       - System requests valid login credentials before granting access.

 **Acceptance Criteria**

- The registered user can log in using a valid email or username and password.
- The system grants access to the protected dashboard after successful authentication.

* The system rejects invalid login credentials and displays a clear error message.

- The system validates required login fields and displays validation messages for missing information.
- The logged-in user can securely log out, and the system ends the session and redirects to the login page.
- The system prevents unauthorized users from accessing protected pages and redirects them to the login page.

**Team Members & Responsibilities**

| **Role Responsibilities ** |                                                                              |
| -------------------------- | ---------------------------------------------------------------------------- |
| **UX/UI Designer **        | Design login screens, error states, logout UI, session expired pages         |
| **Frontend Developer **    | Implement login form, validation, API integration, routing guards, logout    |
| **Backend Developer **     | Implement login API, JWT generation, validation, logout, session management  |

---

---

**US-AUTH-03:** Password Reset and Change (Traces to R0.06, R0.07)
*    "As a user, I want to change my password or receive a secure reset link via email so that I can maintain account security or restore access to my account."*
**Story ID: US-AUTH-03**
**Requirements: R0.06, R0.07**
** Priority: High**
** Sprint: Sprint 1**

**User Story**

 As a user, I want to change my password or receive a secure reset link via email so that I can maintain account security or restore access to my account.

**Scenarios**
**Scenario 1: (Happy Path — Change Password While Logged In)**

1. Authenticated user navigates to account security settings.
2. User enters their current password.
3. User enters a new password and confirms it.
4. System verifies the current password is correct and the new password matches the confirmation and complies with security policies.
5. System updates the password and displays a success message.
6. System notifies the user via email that their password was changed.

**Scenario 2: (Happy Path — Password Reset via Email)**

1. User selects "Forgot Password" and enters their registered email address.
2. System generates a single-use, time-limited reset token and sends it to the user's email.
3. User clicks the reset link within the validity period.
4. User enters a new password and confirms it.
5. System validates the token and the new password, then updates the credentials.
6. User is able to log in with the new password.

**Scenario 3: (Incorrect Current Password)**

1. User enters an incorrect current password while attempting to change their password.
2. System rejects the request and displays a clear error message.
3. User is prompted to re-enter the correct current password.

**Scenario 4: (Password Mismatch or Weak Password)**

1. User enters a new password and confirmation that do not match, or that do not meet complexity requirements.
2. System rejects the request and displays a clear error message specifying the issue.
3. User re-enters a valid, matching password.

**Scenario 5: (Expired or Invalid Reset Token)**

1. User clicks a reset link after the token has expired, or with an invalid/already-used token.
2. System rejects the request and displays an "Invalid or expired link" message.
3. System offers the user an option to request a new reset link.

**Acceptance Criteria**

- An authenticated user can change their password by providing their current password and a new password (with confirmation).
- The system rejects password change attempts with an incorrect current password.
- The new password must match its confirmation and comply with the configured security/complexity policy.
- A user can request a password reset via their registered email, and the system generates a single-use, time-limited reset token.
- The reset token becomes invalid after use or after its expiration period.
- The system notifies the user by email whenever their password is successfully changed or reset.

**Team Members & Responsibilities**

| **Role Responsibilities ** |                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------- |
| **UX/UI Designer **        | Design password change screens, reset flow, email templates, error states       |
| **Frontend Developer **    | Implement password change form, reset flow, validation, API integration         |
| **Backend Developer **     | Implement change/reset APIs, token generation, email service, password hashing  |

---

**US-PROF-01:** Profile Setup and Updating (Traces to R0.04, R0.05)
*   "As an authenticated user, I want to set up and edit my personal details so that my profile remains accurate and up to date."*

**Story ID: US-PROF-01**
**Requirements: R0.04, R0.05**
**Priority: High**
**Sprint: Sprint 1**
**User Story**
*    "As an authenticated user, I want to set up and edit my personal details so that my profile remains accurate and up to date."*
**Scenarios**
**Scenario 1: (Happy Path — Profile Setup and Edit)**
1\. User navigates to the profile settings section.
2\. User enters or updates personal details (e.g., full name, phone number, address, and profile picture).
3\. User submits the updated information.
4\. System validates all fields.
5\. System saves the updated profile information.
6\. System displays a success message confirming the profile update.
**Scenario 2: (Incomplete or Invalid Profile Data)**
1\. User leaves required fields empty or enters invalid data formats.
2\. User attempts to save changes.
3\. System prevents form submission.
4\. System displays clear error messages indicating missing or invalid fields.
**Scenario 3: (Profile Picture Upload Failure)**
1\. User attempts to upload an unsupported file type or an oversized profile picture.
2\. System rejects the uploaded file.
3\. System shows an explicit error message specifying file constraints.
**Scenario 4: (Cancel Profile Editing)**
1\. User makes changes to personal profile fields.
2\. User clicks the "Cancel" button.
3\. System discards all unsaved changes.
4\. System returns the user to the profile view with original data unchanged.

**Acceptance Criteria**
•	The user can view their personal profile information upon accessing the profile page.
•	The user can edit personal details including full name, phone number, address, and profile picture with all input fields validated.
•	The system prevents saving incomplete or invalid profile inputs and displays relevant error messages.
•	The system allows uploading a valid profile picture while enforcing constraints on file size and format.
•	The user can cancel edits, restoring previous profile values without saving modifications.
•	The updated profile information is securely stored and reflected across the platform immediately.

**Team Members & Responsibilities**

| **Role Responsibilities ** |                                                                                |
| -------------------------- | ------------------------------------------------------------------------------ |
| **UX/UI Designer **        | Design profile pages, edit forms, validation states, avatar upload components  |
| **Frontend Developer **    | Implement profile view/edit forms, validation, image upload, API integration   |
| **Backend Developer **     | Implement profile CRUD APIs, validation, file storage, data security           |

---

#### 4.1.4 Execution Timeline and Milestone Phases

Sprint 1 is structured over a two-week timebox (ten business days), running from August 1, 2026, to August 10, 2026. The execution timeline is divided into distinct operational phases:

- Phase 1: Environment Setup & Architecture Initialization (Days 1–2  Aug): Database schema creation for user accounts, account types, and auth tokens; setup of JWT signing keys; email service configuration; and project repository structure configuration.

* Phase 2: Authentication Core Development (Days 3–5 Aug): Implementation of registration with account type selection (R0.01, R0.03), login with JWT issuance and logout (R0.02, R0.08), email verification (R0.09), and password recovery/change services (R0.06, R0.07).

- Phase 3: Profile Subsystem Development (Days 6–7 Aug): Implementation of profile setup (R0.04), retrieval, and metadata updates (R0.05).

* Phase 4: Integration, Testing & Review (Days 8–10 Aug): End-to-end API integration, automated testing execution, security vulnerability verification, and final sprint review.
