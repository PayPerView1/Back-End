###   SPRINT 2: CAMPAIGN CREATION AND MANAGEMENT (BRAND/ADVERTISER)

#### Overview and Primary Objective

    Sprint 2 focuses on enabling Brand/Advertiser users to create, manage, and review campaigns. The primary objective is to deliver a comprehensive campaign management system that allows advertisers to define campaign parameters, upload source materials, submit campaigns for review, and manage their campaign portfolio.

#### Allocated Functional Requirements

- R1.01 (Creating a New Campaign): The system shall allow advertisers to create a new campaign by filling out a form containing: campaign name, total budget, CPM (cost per thousand views), type of content required, and uploading source materials (raw videos, images, text).
- R1.02 (Determining the Required Content Type): The system shall allow advertisers to select from the following content types: Clipping, Full UGC, Slideshow, Audio Only, Logo Support, Public Figure Content.
- R1.03 (Writing the Creative Brief): The system shall allow advertisers to write clear instructions for content creators, including: main idea, desired tone, key messages, keywords, and visual references, if applicable.
- R1.04 (Defining the Target Audience Geographically): The system shall allow advertisers to specify the target countries/regions for views. The campaign will only be shown to content creators who have an audience in these regions.
- R1.05 (Defining the Campaign's Sharia Compliance): The system shall require advertisers to sign/declare that the campaign content adheres to the "Halal Content" policy through a mandatory form including: No gambling, Preventing inappropriate content, no explicit music, no alcoholic beverages, no suspicious currencies, no unrealistic profit claims.
- R1.06 (Attaching Source Material Files): The system shall allow advertisers to upload source material, which may include raw video footage, images, text, approved background music, and brand logos.
- R1.07 (Saving Campaign as a Draft): The system shall allow advertisers to save the campaign as a draft before publishing, to return to it later and edit it.
- R1.08 (Submitting Campaign for Review): After all required information is completed, the system shall automatically review the campaign using AI to verify compliance with platform policies, campaign quality, and content requirements. Based on the AI assessment, the campaign shall be approved, rejected with reasons, or marked for manual review before publication.
- R1.09 (Reviewing Previous Campaigns): The system shall display a list of all the advertiser's previous campaigns with their status (Pending Review, Active, Completed, Cancelled, Rejected) and allow searching and filtering.
- R1.10 (Copying a Previous Campaign): The system shall allow advertisers to copy a previous campaign (with the same settings) to quickly create a new campaign, with the ability to edit the data before publishing.
- R3.02 (Campaign Classification System): When creating a campaign, the system shall require advertisers to classify it into specific categories: Clipping, UGC, Slideshow, Audio, Logo, Mixed.

#### User Story Backlog Headlines

**US-CAMP-01: Create and Submit Campaign (Traces to R1.01, R1.02, R1.03, R1.04, R1.05, R1.06, R1.08)**
**Story ID: US-CAMP-01**
**Requirements: R1.01, R1.02, R1.03, R1.04, R1.05, R1.06, R1.08**
**Priority: High**
**Sprint: Sprint 2**

**User Story**
*"As an advertiser, I want to create a campaign with all necessary details, upload source materials, declare Halal compliance, and submit it for review so that content creators can apply to work on my campaign."*


**Scenarios**
**Scenario 1: (Happy Path — Full Campaign Creation and Submission)**

- Advertiser logs into the platform.
- Advertiser taps "Create New Campaign."
- Advertiser fills in campaign details: campaign name, total budget, CPM, content type, creative brief, and target audience.
- Advertiser uploads source materials (videos, images, text, music, logos).
- Advertiser declares Halal compliance through mandatory form.
- Advertiser submits the campaign for review.
- System validates all required fields and files.
- System runs AI automatic review.
- System creates the campaign with “Pending Review” status.
- System sends confirmation notification to the advertiser.

**Scenario 2: (Missing Required Fields)**

- Advertiser attempts to submit without completing all required fields.
- System highlights missing fields and displays error message.
- System prevents submission.

**Scenario 3: (AI Review — Campaign Approved)**

- System runs AI review on submitted campaign.
- AI checks compliance, quality, and content requirements.
- Campaign status changes to "Active" (approved).
- Advertiser receives approval notification.

**Scenario 4: (AI Review — Campaign Rejected)**

- System runs AI review on submitted campaign.
- AI detects policy violations or quality issues.
- Campaign status changes to "Rejected."
- System provides detailed rejection reasons.
- Advertiser receives rejection notification with feedback.

**Scenario 5: (AI Review — Marked for Manual Review)**

- System runs AI review and is unable to make a clear decision.
- Campaign status changes to "Manual Review Required."
- System notifies admin team for manual review.

**Acceptance Criteria**

- Advertiser can fill all campaign fields (name, budget, CPM, content type, creative brief, target audience).
- Advertiser can upload source materials (max 10 files, 20MB each, supported formats: MP4, JPG, PNG, PDF, MP3, AI).
- Advertiser must complete Halal compliance declaration with all required checkboxes.
- System automatically runs AI review upon submission.
- Campaign status updates based on AI review (Approved/Rejected/Manual Review).
- System provides clear feedback for rejection.
- All data is securely stored.

**Tasks**
**UI/UX (Figma)**

- Design multi-step campaign creation form.
- Design Halal compliance declaration form.
- Design file upload component.
- Design AI review status screen.

**Backend**

- Create POST /api/campaigns (campaign creation).
- Implement file upload service with validation.
- Implement Halal compliance validation.
- Integrate AI review service.
- Create campaign status management.

**Frontend**

- Build multi-step form with validation.
- Build file upload widget.
- Build AI review status widget.
- Build submission confirmation screen.

**Database**

- Create campaigns table with all required fields.
- Create campaign\_materials table.
- Create campaign\_halal\_declaration table.


**US-CAMP-02: Save Campaign as Draft (Traces to R1.07)**
**Story ID: US-CAMP-02**
**Requirements: R1.07**
**Priority: Medium**
**Sprint: Sprint 2**

**User Story**
*"As an advertiser, I want to save my campaign as a draft so that I can return later to complete and edit it before submission."*

**Scenarios**
**Scenario 1: (Happy Path — Save as Draft)**

- Advertiser starts creating a new campaign.
- Advertiser fills in partial campaign details (campaign name, budget, CPM, etc.).
- Advertiser taps "Save as Draft" button.
- System validates required fields for draft (only campaign name is mandatory).
- System saves all entered data with status "Draft".
- System displays confirmation message: "Campaign saved as draft successfully."
- System redirects advertiser to the campaign dashboard.
- Campaign appears in the "Drafts" section with a draft badge.

**Scenario 2: (Resume Draft from Dashboard)**

- Advertiser navigates to "My Campaigns" dashboard.
- Advertiser selects the "Drafts" filter.
- System displays all draft campaigns.
- Advertiser taps on a draft campaign.
- System loads all previously saved data into the creation form.
- Advertiser can continue editing from where they left off.

**Scenario 3: (Auto-Save While Editing)**

- Advertiser is filling the campaign creation form.
- System automatically saves the form data every 30 seconds.
- System displays a subtle indicator: "Auto-saving..." then "Saved".
- If the app crashes or the user closes the app, data is preserved.
- When the advertiser returns, the system shows a prompt: "You have an unsaved draft. Continue editing?"

**Scenario 4: (Edit Draft Before Submission)**

- Advertiser opens a draft campaign.
- Advertiser completes all required fields.
- Advertiser adds source materials and declares Halal compliance.
- Advertiser submits the campaign for review.
- System runs AI review and updates status accordingly.

**Scenario 5: (Delete Draft)**

- Advertiser views a draft campaign in the dashboard.
- Advertiser taps "Delete" on the draft.
- System shows confirmation dialog: "Are you sure you want to delete this draft?"
- Advertiser confirms deletion.
- System permanently removes the draft campaign.
- System shows confirmation message: "Draft deleted successfully."

**Scenario 6: (Draft Expiration)**

- A draft campaign has not been updated for 30 days.
- System automatically marks the draft as "Expired".
- System sends an email notification: "Your campaign draft has expired due to inactivity."
- Advertiser can still view the expired draft but cannot submit it without re-creating.

**Scenario 7: (Attempt to Submit Incomplete Draft)**

- Advertiser tries to submit a draft campaign without completing all required fields.
- System prevents submission.
- System highlights all missing required fields in red.
- System displays error message: "Please complete all required fields before submitting."
- System allows the advertiser to continue editing or save as draft again.

**Scenario 8: (Save as Draft with No Campaign Name)**

- Advertiser tries to save a draft without entering a campaign name.
- System displays error: "Campaign name is required to save as draft."
- System highlights the campaign name field.
- System prevents saving until a name is entered.

**Scenario 9: (Multiple Drafts)**

- Advertiser saves multiple campaigns as drafts.
- System displays all drafts in the dashboard with creation dates and last modified timestamps.
- System allows the advertiser to sort drafts by date, name, or status.

**Acceptance Criteria**

- The advertiser can save a campaign as a draft at any point during the creation process.
- The system only requires the campaign name to save a draft (other fields are optional for draft status).
- All entered data (form fields, uploaded files, Halal compliance selection) is persisted when saving as draft.
- The system auto-saves the campaign every 30 seconds while the advertiser is editing.
- The advertiser can view all draft campaigns in the "Drafts" section of the dashboard.
- The advertiser can resume editing any draft campaign from where they left off.
- The advertiser can delete a draft campaign with confirmation.
- The system prevents submission of incomplete drafts and highlights missing fields.
- The system auto-expires drafts after 30 days of inactivity.
- The advertiser receives a confirmation notification when a draft is saved.
- The system displays a visual indicator showing save status (Saving... / Saved).
- All draft data is securely stored and linked to the advertiser's account.
- The advertiser can have unlimited draft campaigns simultaneously.

**Tasks**
**UI/UX (Figma)**

- Design "Save as Draft" button in the campaign creation form.
- Design draft status badge for campaign cards.
- Design auto-save indicator (Saving... / Saved / Error).
- Design draft resume prompt when returning to an incomplete campaign.
- Design delete draft confirmation dialog.
- Design draft expiration notification banner.
- Design drafts filter and section in campaign dashboard.

**Backend**

- Create POST /api/campaigns/draft endpoint to save draft.
- Create GET /api/campaigns/draft/{id} endpoint to retrieve draft.
- Create PUT /api/campaigns/draft/{id} endpoint to update draft.
- Create DELETE /api/campaigns/draft/{id} endpoint to delete draft.
- Create PUT /api/campaigns/draft/{id}/auto-save endpoint for auto-save functionality.
- Implement draft validation (only campaign name required).
- Implement draft auto-expiry job (runs daily to mark drafts older than 30 days as expired).
- Implement auto-save conflict handling (if two auto-save requests conflict, use latest version).
- Add version tracking for draft changes.

**Frontend**

- Build "Save as Draft" button with loading state.
- Build auto-save timer (triggers every 30 seconds).
- Build auto-save status indicator widget.
- Build draft resume prompt dialog.
- Build delete draft confirmation dialog.
- Build drafts filter in campaign dashboard.
- Implement form state persistence using local storage or provider pattern.
- Add draft restoration logic when user opens the app.
- Build draft expiration warning banner.

**Database**

- Create campaign\_drafts table with fields:
- id (UUID, Primary Key)
- advertiser\_id (UUID, Foreign Key to users table)
- campaign\_name (VARCHAR, Required)
- budget (DECIMAL, Optional)
- cpm (DECIMAL, Optional)
- content\_type (VARCHAR, Optional)
- creative\_brief (TEXT, Optional)
- target\_audience (JSON, Optional)
- halal\_compliance\_declared (BOOLEAN, Optional)
- status (ENUM: DRAFT, EXPIRED)
- last\_saved\_at (TIMESTAMP)
- expires\_at (TIMESTAMP, Default: NOW() + 30 days)
- version (INTEGER, Default: 1)
- created\_at (TIMESTAMP)
- updated\_at (TIMESTAMP)
- Create draft\_materials table with fields:
- id (UUID, Primary Key)
- draft\_id (UUID, Foreign Key to campaign\_drafts table)
- file\_url (VARCHAR)
- file\_type (VARCHAR)
- file\_name (VARCHAR)
- uploaded\_at (TIMESTAMP)
- Add indexes on:
- advertiser\_id for fast retrieval of user drafts.
- status for filtering drafts vs. expired drafts.
- last\_saved\_at for auto-expiry queries.

**AI Engineer**

- Build AI-powered draft completion suggestions.
- Implement draft content analysis for early Halal compliance check.
- Build content quality scoring system for drafts.
- Implement duplicate draft detection.
- Build predictive expiry notification system.


**US-CAMP-03: Manage Campaign Portfolio (Traces to R1.09, R1.10)**
**Story ID: US-CAMP-03**
**Requirements: R1.09, R1.10**
**Priority: High**
**Sprint: Sprint 2**

**User Story**
*"As an advertiser, I want to view and filter all my previous campaigns and copy existing ones so that I can efficiently manage my marketing activities."*

**Scenarios**
**Scenario 1: (Happy Path — View All Campaigns)**

- Advertiser navigates to "My Campaigns" dashboard.
- System displays list of all campaigns with details: name, status, budget, content type, creation date.
- Each campaign shows its current status badge (Pending Review, Active, Completed, Cancelled, Rejected, Manual Review, Draft, Expired).

**Scenario 2: (Filter by Status)**

- Advertiser selects a status filter from dropdown (e.g., "Active").
- System displays only campaigns with that status.

**Scenario 3: (Filter by Date Range)**

- Advertiser selects a date range (e.g., "Last 30 days", "Last 3 months", "Custom range").
- System displays campaigns created within that period.

**Scenario 4: (Search by Campaign Name)**

- Advertiser types a campaign name in the search bar.
- System filters campaigns matching the search term with autocomplete suggestions.

**Scenario 5: (Sort Campaigns)**

- Advertiser selects sort option: "Newest First", "Oldest First", "Highest Budget", "Lowest Budget", "A-Z", "Z-A".
- System reorders campaigns accordingly.

**Scenario 6: (Copy Campaign — Happy Path)**

- Advertiser views campaign list.
- Advertiser taps "Copy" on a previous campaign.
- System creates a new draft with all settings copied (name, budget, CPM, content type, brief, target audience, materials, Halal compliance).
- System appends "(Copy)" to the campaign name.
- System redirects advertiser to edit form with copied data.
- Advertiser edits any fields as needed.
- Advertiser submits new campaign for review.

**Scenario 7: (Copy Campaign with Custom Name)**

- Advertiser taps "Copy" on a previous campaign.
- System shows dialog: "Enter new campaign name".
- Advertiser enters custom name.
- System creates draft with custom name.

**Scenario 8: (Copy Campaign Without Copying Materials)**

- Advertiser taps "Copy" and unchecks "Copy source materials" option.
- System creates draft with all settings but without source materials.
- Advertiser can upload new materials.

**Scenario 9: (Copy Campaign with Modification)**

- Advertiser copies a campaign.
- Advertiser modifies budget, changes content type, updates creative brief.
- System saves changes.
- Advertiser submits updated campaign.

**Scenario 10: (Empty State — No Campaigns)**

- Advertiser has no campaigns created yet.
- System displays friendly empty state with illustration and "Create Your First Campaign" CTA button.

**Scenario 11: (Campaign Details View)**

- Advertiser taps on a campaign card.
- System navigates to campaign details screen showing:
- All campaign information
- Source materials list with preview
- Performance metrics (if campaign is Active or Completed)
- Status history timeline
- AI review results and feedback

**Scenario 12: (Bulk Actions)**

- Advertiser selects multiple campaigns using checkboxes.
- System shows bulk action options: "Delete Selected", "Archive Selected", "Export Data".
- Advertiser confirms action.
- System executes bulk action.

**Scenario 13: (Pagination)**

- Advertiser has more than 20 campaigns.
- System displays 20 campaigns per page.
- Advertiser navigates to next/previous pages.

**Scenario 14: (Export Campaign Data)**

- Advertiser taps "Export" on a campaign.
- System generates CSV/Excel report with:
- Campaign details
- Budget and spending
- Content creator applications
- Performance metrics
- System downloads the file.

**Scenario 15: (Archive Campaign)**

- Advertiser taps "Archive" on a completed campaign.
- System moves campaign to "Archived" status.
- Campaign no longer appears in main list unless "Archived" filter is selected.

**Scenario 16: (Restore Archived Campaign)**

- Advertiser selects "Archived" filter.
- Advertiser taps "Restore" on an archived campaign.
- System moves campaign back to its previous status.

**Scenario 17: (View Campaign Statistics Summary)**

- Advertiser sees statistics cards at top of dashboard:
- Total Campaigns
- Active Campaigns
- Completed Campaigns
- Total Budget Spent
- Average CPM


**Scenario 18: (Quick Actions from Campaign Card)**

- Advertiser taps three-dot menu on campaign card.
- System shows quick actions: "Edit", "Copy", "Archive", "Delete", "View Details", "Export".
- Advertiser selects an action.

**Scenario 19: (Campaign Status Transition Timeline)**

- Advertiser views campaign details.
- System displays status transition timeline:
- Draft → Pending Review → Active → Completed
- Or Draft → Pending Review → Rejected
- Shows timestamps for each status change.

**Scenario 20: (Performance Metrics Preview)**

- Advertiser views campaign list.
- System shows quick metrics on each card:
- Active campaigns: Views, CTR, Engagement
- Completed campaigns: Total Views, Cost per View, ROI

**Acceptance Criteria**

- All campaigns are displayed in a list view with pagination.
- Each campaign shows: name, status, budget, content type, date created, and quick metrics.
- Advertiser can filter by status (All, Draft, Pending Review, Active, Completed, Cancelled, Rejected, Manual Review, Archived, Expired).
- Advertiser can filter by date range (Today, Last 7 days, Last 30 days, Last 3 months, Custom).
- Advertiser can search by campaign name with autocomplete.
- Advertiser can sort by: Newest First, Oldest First, Highest Budget, Lowest Budget, A-Z, Z-A.
- Advertiser can copy any campaign with one click.
- Copied campaign includes all settings and materials (optional toggle).
- Copied campaign is saved as a draft with "(Copy)" suffix.
- Advertiser can edit copied campaign before submission.
- Advertiser can view campaign details screen with full information.
- Advertiser can archive and restore campaigns.
- Advertiser can export campaign data as CSV.
- Advertiser can perform bulk actions (delete, archive, export).
- Statistics summary cards show at top of dashboard.
- Quick actions menu available on each campaign card.
- Status transition timeline displayed in details view.
- Loading states are displayed during data fetch.
- Empty state is shown when no campaigns exist.
- All campaign data is securely stored and linked to advertiser's account.
- Data loads within 2 seconds under normal network conditions.

**Tasks**
**UI/UX (Figma)**

- Design campaign dashboard screen with statistics cards.
- Design campaign card component with status badge and quick metrics.
- Design filter components (status dropdown, date range picker, search bar).
- Design sort options dropdown.
- Design campaign details screen with timeline.
- Design copy campaign modal/dialog.
- Design bulk action selection and toolbar.
- Design empty state illustration and CTA.
- Design quick actions menu (three-dot menu).
- Design archived section and restore functionality.
- Design export data modal.
- Design pagination component.
- Design performance metrics preview widgets.
- Design status transition timeline component.
- Design mobile-responsive campaign portfolio view.

** Backend**

- Create GET /api/campaigns endpoint (list all campaigns with filters).
- Implement pagination (limit/offset or cursor-based).
- Implement status filtering logic.
- Implement date range filtering logic.
- Implement search by campaign name with autocomplete.
- Implement sorting logic (multiple sort options).
- Create GET /api/campaigns/{id} endpoint (campaign details).
- Create POST /api/campaigns/{id}/copy endpoint (copy campaign).
- Create PUT /api/campaigns/{id}/archive endpoint (archive campaign).
- Create PUT /api/campaigns/{id}/restore endpoint (restore archived campaign).
- Create DELETE /api/campaigns/{id} endpoint (delete campaign).
- Create POST /api/campaigns/bulk-delete endpoint (bulk delete).
- Create POST /api/campaigns/bulk-archive endpoint (bulk archive).
- Create GET /api/campaigns/{id}/export endpoint (export campaign data as CSV).
- Create GET /api/campaigns/statistics endpoint (dashboard statistics summary).
- Implement deep copy logic for all campaign data (including materials and Halal declaration).
- Implement copy with optional materials toggle.
- Add campaign name uniqueness validation (per advertiser).
- Implement campaign status transition validation.
- Implement performance metrics calculation for campaign details.
- Add campaign activity logging (status changes, actions).

**Frontend**

- Build campaign dashboard screen with statistics cards.
- Build campaign list with infinite scroll or pagination.
- Build campaign card widget with status badge and metrics preview.
- Build filter chips/bars for status filtering.
- Build date range picker widget.
- Build search bar with autocomplete suggestions.
- Build sort options dropdown.
- Build copy campaign modal with options (custom name, include materials).
- Build campaign details screen with:
- Full campaign information
- Source materials gallery
- Status transition timeline
- Performance metrics charts
- AI review feedback display
- Build quick actions menu (three-dot menu).
- Build archive and restore confirmation dialogs.
- Build bulk selection mode with checkbox selection.
- Build bulk action toolbar (Delete, Archive, Export).
- Build export data generation and download.
- Build pagination controls.
- Build empty state widget.
- Build loading skeletons for campaign cards.
- Build error state with retry button.
- Implement deep linking to campaign details from notifications.
- Add pull-to-refresh functionality on campaign list.
- Build archived campaigns section/filter.
- Implement campaign status color coding system.
- Build campaign statistics summary cards.
- Add campaign count badges for each status filter.

**Database**

- Create indexes on:
- advertiser\_id for fast retrieval
- status for filtering
- created\_at for date range queries
- campaign\_name for search (using GIN or trigram indexes)
- budget for sorting
- Add archived\_at column to campaigns table (TIMESTAMP, nullable).
- Add archived boolean column to campaigns table (default: false).
- Add copy\_count column to campaigns table (track how many times copied).
- column to campaigns table (track copy source).
- Create campaign\_activity\_log table with fields:
- id (UUID, Primary Key)
- campaign\_id (UUID, Foreign Key)
- action (VARCHAR: CREATED, SUBMITTED, APPROVED, REJECTED, ARCHIVED, RESTORED, COPIED, DELETED)
- performed\_by (UUID, Foreign Key to users)
- timestamp (TIMESTAMP)
- metadata (JSON)
- Add performance\_metrics JSON column to campaigns table (cached metrics).
- Create materialized views for campaign statistics.
- Write migration scripts for all changes.
- Create backup strategy for campaign data.

**AI Engineer**

- Build campaign similarity detection (suggest similar campaigns to copy).
- Implement smart campaign recommendations based on performance.
- Build campaign performance prediction for copied campaigns.
- Implement content quality scoring in campaign details.
- Build automated campaign categorization based on content.


 **US-CAMP-04: Classify Campaign Content (Traces to R3.02)**
**Story ID: US-CAMP-04**
**Requirements: R3.02**
**Priority:  Medium**
**Sprint: Sprint 2**

**User Story**
*"As an advertiser, I want to classify my campaign into appropriate categories so that content creators can find relevant opportunities."*

**Scenarios**
**Scenario 1: (Happy Path — Single Category Selection)**

- Advertiser is creating/editing a campaign.
- Advertiser sees category selection field.
- Advertiser selects one category from dropdown: Clipping, UGC, Slideshow, Audio, Logo.
- System validates selection and saves category.

**Scenario 2: (Select Mixed Category)**

- Advertiser selects "Mixed" from category dropdown.
- System displays additional sub-category selection.
- Advertiser selects multiple sub-categories (e.g., Clipping + UGC + Audio).
- System saves Mixed category with selected sub-categories.

**Scenario 3: (Edit Existing Campaign)**

- Advertiser opens an existing campaign for editing.
- System pre-selects the previously chosen category.
- Advertiser changes category from Clipping to Slideshow.
- System updates campaign classification.

**Scenario 4: (Required Field Validation)**

- Advertiser attempts to submit campaign without selecting a category.
- System highlights category field in red.
- System displays error: "Please select a campaign category."
- System prevents submission until category is selected.

**Scenario 5: (Copy Campaign with Classification)**

- Advertiser copies a campaign.
- System includes the classification from the original campaign.
- Advertiser can change category before submitting.

**Scenario 6: (View Campaign Category in List)**

- Advertiser views campaign dashboard.
- System displays category badge on each campaign card.
- Advertiser can filter campaigns by category.

**Scenario 7: (Category Icons and Descriptions)**

- Advertiser hovers/taps on category selection.
- System displays tooltip with description for each category:
- Clipping: Short video clips from source material
- UGC: User-generated content style
- Slideshow: Image-based slideshow with transitions
- Audio: Audio-only content (podcasts, music)
- Logo: Logo animation or design
- Mixed: Combination of multiple content types

**Scenario 8: (Sub-Category Validation for Mixed)**

- Advertiser selects "Mixed" but does not select any sub-category.
- System displays error: "Please select at least one content type for Mixed category."
- System prevents submission.

**Scenario 9: (Category Statistics in Dashboard)**

- Advertiser views campaign statistics.
- System shows breakdown of campaigns by category.
- Advertiser sees which categories perform best.

**Scenario 10: (Category Change — Dependent Fields)**

- Advertiser selects category "Audio".
- System hides video/image upload fields.
- System shows audio-specific fields (duration, format, etc.).
- Advertiser selects category "Clipping".
- System shows video-specific fields (duration, resolution, etc.).

**Acceptance Criteria**

- Advertiser can select one category per campaign from predefined list.
- Categories available: Clipping, UGC, Slideshow, Audio, Logo, Mixed.
- "Mixed" category requires selection of at least one sub-category.
- Category selection is mandatory before campaign submission.
- Category is displayed on campaign cards and details page.
- Advertiser can filter campaigns by category.
- Category descriptions are displayed as tooltips/hints.
- Sub-category validation is enforced for "Mixed" category.
- Category copy is included when copying campaigns.
- Category field is accessible in both create and edit flows.
- Category selection affects dependent fields (show/hide relevant options).
- Statistics show campaign breakdown by category.
- All category data is securely stored.


**Tasks**
**UI/UX (Figma)**

- Design category selection dropdown with icons.
- Design category tooltip/description on hover/select.
- Design category badges for campaign cards.
- Design category filter chips in campaign dashboard.
- Design sub-category selection for "Mixed" category.
- Design category performance statistics chart.
- Design category selection in campaign creation form.
- Design category selection in campaign edit form.
- Design conditional fields based on category selection.
- Design mobile-friendly category selector.
- Design category selection confirmation dialog.

**     Backend**

- Create GET /api/campaign/categories endpoint (list all categories with descriptions).
- Create GET /api/campaign/sub-categories endpoint (list sub-categories for Mixed).
- Add category validation in campaign creation endpoint (POST /api/campaigns).
- Add category validation in campaign update endpoint (PUT /api/campaigns/{id}).
- Implement category filtering logic in GET /api/campaigns endpoint.
- Add sub-category validation for "Mixed" category.
- Implement category statistics calculation.
- Add category to campaign copy logic (POST /api/campaigns/{id}/copy).
- Implement conditional field logic based on category.
- Add category badges to campaign list response.
- Validate category is not null before submission.

**Frontend**

- Build category dropdown widget with icons.
- Build category tooltip component.
- Build category badge widget for campaign cards.
- Build category filter chips in campaign dashboard.
- Build sub-category multi-select widget for "Mixed".
- Build category statistics chart widget.
- Integrate category selection in campaign creation form.
- Integrate category selection in campaign edit form.
- Implement conditional field display based on category.
- Build category selection validation.
- Add category filter to campaign search/filter state.
- Build category selection saved state (draft support).
- Implement category display in campaign details screen.
- Add category export in campaign data export.
- Build category selection analytics tracking.

**Database**

- Add category column to campaigns table (VARCHAR, ENUM).
- Add sub\_categories column to campaigns table (JSON/Array, nullable).
- Create campaign\_categories reference table:
- id (UUID, Primary Key)
- name (VARCHAR, Unique)
- description (TEXT)
- icon (VARCHAR)
- is\_active (BOOLEAN)
- order (INTEGER)
- created\_at (TIMESTAMP)
- Create campaign\_sub\_categories reference table:
- id (UUID, Primary Key)
- name (VARCHAR)
- description (TEXT)
- category\_id (UUID, Foreign Key)
- is\_active (BOOLEAN)
- created\_at (TIMESTAMP)
- Add foreign key constraints for category validation.
- Add indexes on:
- category column for filtering
- sub\_categories for querying
- Write migration scripts.
- Seed default categories and sub-categories.
- Add category to campaign copy (including sub-categories).

**AI Engineer**

- Build automatic category suggestion based on campaign content.
- Implement category prediction from creative brief text (NLP).
- Build category recommendation based on similar campaigns.
- Implement category performance analytics (which categories perform best).
- Build intelligent sub-category recommendation.

#### Execution Timeline and Milestone Phases

Phase 2 (Sprint 2) will be implemented over a period of ten working days: From August 11 to August 20 - August 22

- Phase 1: Campaign Data Model & Setup (Days Aug 11 – Aug 12): Database schema creation for campaigns, content types, classifications, and source materials storage configuration.
- Phase 2: Campaign Creation Core (Days Aug 13 – Aug 16): Implementation of campaign creation form, content type selection, creative brief writing, geographic targeting, Halal compliance declaration, and source material upload (R1.01–R1.07).
- Phase 3: Campaign Management (Days Aug 17 – Aug 18): Implementation of campaign submission, review status management, campaign listing with search/filter, and campaign copy functionality (R1.08–R1.10, R3.02).
- Phase 4: Integration, Testing & Review (Days Aug 19 – Aug 20): End-to-end API integration, automated testing, and sprint review.
