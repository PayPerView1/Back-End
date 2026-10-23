SPRINT 5: CONTENT PRODUCTION AND PUBLISHING (CONTENT CREATOR)
Overview
Main Objective: To enable content creators to produce and publish content for accepted campaigns—starting with downloading source materials, proceeding to video production and publishing on social media platforms, and finally submitting the post link along with managing keywords and hashtags.
Specific Functional Requirements (6 requirements)
Code	Description

R2.07	Download source materials for accepted campaigns

R2.08	Produce the required video clip according to the brief and instructions

R2.09	Publish the clip on social media platforms (TikTok, Instagram Reels, YouTube Shorts)

R2.10	Submit the post link with automated verification and AI review

R2.11	Add required keywords and hashtags

R2.12	Update the post link upon reposting or editing
User Stories (4 stories)
US-PRODUCTION-01: Download Source Materials
Story ID: US-PRODUCTION-01
Requirements: R2.07
Priority: High
Sprint: Sprint 5
User Story
"As a content creator, I want to download all source materials for the campaign so that I have everything I need to produce my content."
Scenarios
Scenario 1: (Happy Path — Downloading Source Materials)
The content creator logs in.

Navigates to the "My Requests" or "Accepted Campaigns" section.

Selects a campaign they have been accepted into. Views a list of available source assets (videos, images, text, music, logos).

Clicks the "Download All" button or selects specific files.

Download begins, accompanied by a progress bar.

A message appears: "Assets downloaded successfully."

Can save the files to their device.
Scenario 2: (Preview before downloading)
Content creator clicks on a file to view it (preview).

Can view the video or image before downloading.

Then decides to download.
Scenario 3: (Download failure)
A network error occurs during the download.

A message appears: "Download failed. Please try again."

Can retry the download.
Scenario 4: (Secure download links)
Download links are signed (Signed URLs) and expire after a certain period.

Links cannot be shared with unauthorized individuals. Scenario 9: (Download Logging)

Each download operation is recorded in the activity log.

The advertiser can see that the content creator has performed a download.
Acceptance Criteria
Content creators can download source assets only for campaigns they have been accepted into.

A list of source assets (videos, images, text, music, logos) is displayed with icons corresponding to the file type.

All assets can be downloaded with a single click, or specific files can be selected for download.

Files can be previewed before downloading.

A progress bar is displayed during the download.

A success message appears upon completion of the download.

Permissions are verified before allowing the download.

Download links are secure and signed (Signed URLs).

Download operations are recorded in the activity log.

An empty state is displayed when no assets are available.

Retries are possible if the download fails.

The design is mobile-responsive.
Tasks
UI/UX (Figma)
Design the "Source Assets" page for accepted campaigns.

Design the file list with type-specific icons.

Design "Download All" and individual download buttons.

Design the download progress bar.

Design the preview window (video, image).

Design success and failure messages.

Design the empty state.

Design for mobile responsiveness
Frontend
Build the source assets page.

Build the file list with icons.

Build download buttons (individual and batch).

Build the download progress bar. Build the preview window.

Build status messages.

Integrate with the backend API.
Backend
Create an API to fetch campaign materials: `GET /api/campaigns/{id}/materials`

Create an API to generate secure download links: `GET /api/materials/{id}/download

Implement authorization checks (the content creator must be accepted into the campaign).

Log download operations in the activity log.

Send a notification when new materials are added.
Database
Use the existing `campaign_materials` table.

Create a `download_logs` table:

`id` (UUID, PK)

`material_id` (UUID, FK)

`creator_id` (UUID, FK)

`downloaded_at` (TIMESTAMP)

Add indexes on `material_id` and `creator_id`.
AI Engineer (Optional)
Analyze source materials to provide suggestions to the content creator.

Detect duplicate or inappropriate materials.
US-PRODUCTION-02: Publish and Submit Content
Story ID: US-PRODUCTION-02
Requirements: R2.08, R2.09, R2.10
Priority: High
Sprint: Sprint 5
User Story
"As a content creator, I want to produce my clip, publish it on social media, and submit the post link so that my work can be reviewed and tracked."
Scenarios
Scenario 1: (Happy Path — Produce, Publish, and Submit)
The content creator downloads the source materials.

Produces the clip using editing software (off-platform).

Publishes it to an account (TikTok, Instagram Reels, YouTube Shorts).

Goes to the platform.

Selects the campaign they were accepted into.

Clicks "Submit Content". Uploads the post link.

Adds the required keywords and hashtags.

Clicks "Send".

The system automatically verifies the...

Link.

AI reviews the content to verify:

Compliance with the brief.

Keywords and hashtags.

Commercial elements.

Quality.

Status displays as "Under Review."

The advertiser is notified that new content is ready for review.
Scenario 2: (Invalid Link)
The content creator uploads an incorrect link.

The system checks and rejects it: "Invalid link. Please check and try again."
Scenario 3: (Unsupported Platform)
The content creator uploads a link from an unsupported platform (e.g., Facebook).

The system rejects it: "Platform not supported. Please use TikTok, Instagram Reels, or YouTube Shorts."
Scenario 4: (Link Not Associated with the Campaign)
The link does not contain the required elements (hashtags, keywords).

The system rejects it: "Content does not meet campaign requirements."
Scenario 5: (Duplicate Link)
The content creator attempts to submit the same link twice.

The system rejects it: "This link has already been submitted."
Scenario 6: (AI Reviews and Accepts)
AI reviews the content and finds it compliant.

Submission status: "Pending advertiser approval" (or "Auto-accepted," depending on policy).
Scenario 7: (AI Reviews and Rejects)
AI finds the content non-compliant.

The reason for rejection is displayed to the content creator (e.g., "Hashtag missing").

They can correct the content and resubmit.
 Scenario 8: (AI Review & Escalation to Manual Review)
The AI ​​is unable to make a decision.

The content is routed for manual review.

The status "Pending Manual Review" is displayed.
Acceptance Criteria
The content creator can access the "Content Submission" page from accepted campaigns.

They can submit a post link from supported platforms (TikTok, Instagram Reels, YouTube Shorts).

The system automatically verifies the validity of the link. The system retrieves post data via API (view count, interactions, etc.).

AI reviews the content to verify: brief compliance, keywords, hashtags, commercial elements, and quality.

Submission status is updated based on the AI ​​review (Accepted/Rejected/Manual Review)

Content creators can add required keywords and hashtags.

Submission of duplicate or invalid links is prevented.

Submission of links from unsupported platforms is prevented.

Submissions can be withdrawn prior to review.

Multiple clips can be submitted for the same campaign (subject to policy).

Notes can be added.

The advertiser is notified of new content.

The content creator is notified of the review result.

All submissions are logged in the database.
Tasks
UI/UX (Figma)
Design the "Content Submission" page with link upload functionality.

Design the submission form (link, keywords, hashtags, notes).

Design the "Under Review" screen with a progress indicator.

Design the AI ​​result screen (Accepted/Rejected/Manual Review) including reasons.

Design the list of previous submissions.

Design the "Withdraw Submission" button.

Design email notifications.

Design a mobile-responsive layout.
Frontend
Build the content submission page.

Build the link upload form with validation.

Build keyword and hashtag input fields.

Build the verification status screen.

Build the AI ​​result screen.

Build the submissions list.

Build the withdrawal button. Backend API Integration.
Backend
Create API for content submission: `POST /api/campaigns/{id}/submissions`

Create API for link verification: `POST /api/submissions/verify-link`

Integrate social media platform APIs (TikTok, Instagram, YouTube) to extract post data.

Integrate AI service for content review.

Create API to withdraw submission: `DELETE /api/submissions/{id}`

Create API to fetch submissions: `GET /api/submissions/my`

Send notifications to the advertiser and content creator.

Prevent duplicate links.
Database
Create `content_submissions` table:

`id` (UUID, PK)

`campaign_id` (UUID, FK)

`creator_id` (UUID, FK)

`post_url` (VARCHAR, unique)

`platform` (ENUM: TIKTOK, INSTAGRAM, YOUTUBE)

`keywords` (JSON)

`hashtags` (JSON)

`notes` (TEXT, nullable)

`ai_review_status` (ENUM: PENDING, APPROVED, REJECTED, MANUAL_REVIEW)

`ai_review_score` (DECIMAL, nullable)

`ai_review_feedback` (TEXT, nullable)

`advertiser_status` (ENUM: PENDING, APPROVED, REJECTED)

`status` (ENUM: SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, WITHDRAWN)

`submitted_at` (TIMESTAMP)

`reviewed_at` (TIMESTAMP, nullable)

Add indexes on `campaign_id`, `creator_id`, `post_url`, and `status`.
AI Engineer
Build a content review model to verify:

Brief alignment (NLP).

Presence of keywords and hashtags.

Commercial elements (Logo detection).

Content quality (Computer Vision).

Build a content scoring system.

Build a system to detect fake or inactive links