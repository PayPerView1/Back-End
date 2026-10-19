SPRINT 4: CAMPAIGN DISCOVERY AND APPLICATION (CONTENT CREATOR)

Overview
Main Objective: To enable content creators to discover available campaigns, review them, apply to them, and save favorites, featuring a smart recommendation system and the ability to report non-compliant campaigns.

Specific Functional Requirements (7 requirements)
Code	Description
R2.01	Browse available campaigns with search and filtering options based on content type and target country
R2.02	View full campaign details (name, source materials, brief, CPM, remaining budget, target countries)
R2.03	Report a non-compliant campaign (by any user) with the option to provide a reason
R2.04	Apply to a campaign ("Apply Now" button)
R2.05	Smart recommendations for suitable campaigns based on the content creator's profile
R2.06	Save campaigns to favorites
R2.07	Automatic campaign suspension upon reporting, pending review
User Stories (5 stories)

US-DISCOVER-01: Browse Campaigns
Story ID: US-DISCOVER-01
Requirements: R2.01, R2.02
Priority: High
Sprint: Sprint 4

User Story
"As a content creator, I want to browse and filter available campaigns while viewing full details, so that I can find opportunities that match my skills and audience." Scenarios

Scenario 1: (Happy Path — Browsing All Campaigns)
The content creator logs in.
They navigate to the "Discover Campaigns" section.
The system displays a list of all active campaigns (available for application).
Each campaign displays: Name, Brand, Content Type, CPM, Remaining Budget, Target Countries, and a "Halal" badge.
Scrolling allows for loading more items (Infinite Scroll or Pagination).





Scenario2: (Filtering by Target Country)
The content creator selects the "Country" filter (Saudi Arabia, UAE, Egypt, etc.).
The system displays campaigns targeting that country.

Scenario 4: (Searching by Name)
The content creator types a campaign or brand name into the search bar.
The system displays matching results along with suggestions.

Scenario 5: (Sorting Campaigns)
The content creator selects a sort option: "Newest," "Highest CPM," "Ending Soon," or "Best Match."
The system reorders the list.

Scenario 6: (Viewing Campaign Details)
The content creator taps on a campaign card. Navigates to the full details page:
Campaign name, brand
Campaign description
Source materials (videos, images, text)
Creative brief (concept, tone, messaging, keywords)
CPM and remaining budget
Target countries
"Halal Content" badge
"Apply Now" button
"Save to Favorites" button

Scenario 7: (Empty state — no campaigns)
No campaigns currently available.
The system displays the message: "No campaigns currently available. Check back later."
An illustration is displayed.

Scenario 8: (Unavailable campaign — budget exhausted)
A campaign that was previously available but has run out of budget.
Appears in the list with a "Completed" or "Unavailable" badge.
Cannot apply for it.

Scenario 9: (Campaign paused due to report)
A campaign that has been reported and temporarily paused.
Does not appear to content creators (hidden) pending review.

Scenario 10: (Previewing source materials)
On the details page, the content creator can preview videos and images (viewing only, not downloading).
The "Download Materials" button appears only after the application is approved.





Acceptance Criteria
The content creator can access the "Discover Campaigns" section from the dashboard.
All active campaigns (available for application) appear in a list. Each campaign displays: Name, Brand, Content Type, CPM, Remaining Budget, Target Countries, and a "Halal" badge.
Filtering options: Content Type, Target Country, Price Range (CPM).
Search functionality by Name or Brand.
Sorting options: Newest, Highest CPM, Ending Soonest, Best Match.
Full campaign details view with source material preview.
Empty state display when no campaigns are available.
Suspended campaigns (due to reports) are hidden from content creators.
Ended campaigns (budget exhausted) appear as "Unavailable."
Data loads within 2 seconds.
Mobile-responsive design.
Full RTL support.

Tasks
UI/UX (Figma)
Design "Discover Campaigns" page with a card list.
Design campaign card (Name, Brand, Type, CPM, Budget, Countries, Halal badge).
Design filter bar (Content Type, Country, Price Range).
Design search bar with suggestions.
Design sorting menu.
Design campaign details page with material preview.
Design empty state.
Design "Halal," "Suspended," and "Unavailable" badges.
Mobile-responsive design.

Frontend
Build "Discover Campaigns" page with a card list.
Build filter components (Dropdown, Multi-select, Range Slider).
Build search bar with Autocomplete.
Build sorting menu.
Build campaign details page with material preview.
Build empty state.
Build pagination or Infinite Scroll. Integration with the backend API.

Backend
Create an API to fetch available campaigns: `GET /api/campaigns/discover`
Support filtering (content type, country, CPM range).
Support search, sorting, and pagination.
Create an API for campaign details: `GET /api/campaigns/{id}/details`
Implement access controls (only active and non-suspended campaigns).
Automatically hide suspended campaigns.




Database
Use the `campaigns` table with appropriate indexes.
Add `is_suspended` (BOOLEAN) and `suspension_reason` (TEXT) columns.
Add indexes on: `status`, `content_type`, `target_countries`, `cpm`, `budget_remaining`.
Write optimized queries for filtering and searching.

AI Engineer (Optional)
Optimize campaign ranking based on matching...content creator profile.
Analyzing browsing behavior to provide better recommendations.

US-MODERATION-02: Reporting a Violating Campaign (Report and Suspend Violating Content)
Story ID: US-MODERATION-02
Requirements: R2.03, R2.07
Priority: High
Sprint: Sprint 4

User Story
"As a user (advertiser, content creator, visitor), I want to report campaigns that violate the Halal content policy; as a reviewer, I want the campaign to be automatically suspended upon reporting until it is reviewed."

Scenarios
Scenario 1: (Happy Path — Reporting a campaign)
The user views a campaign or its details.
Clicks the "Report" button.
A window appears requesting the reason for the report (dropdown menu: sexual content, gambling, explicit music, suspicious currencies, false profit claims, other).
Selects the reason (option to add details).
Clicks "Submit Report".
The system records the report.
The campaign is automatically suspended (becomes invisible to content creators).
The review team is notified.
A message appears to the user: "Your report has been received. The campaign will be reviewed."

Scenario 2: (Reporting with additional details)
The user selects "Other" and enters details.
The system accepts the report.

Scenario 3: (Repeated report for the same campaign)
The same user attempts to report the same campaign again. The system prevents duplicate reports and displays: "You have already reported this campaign."


Scenario 4: (Report review — Violation confirmed)
The review team examines the campaign.
A violation is found.
The campaign is permanently cancelled.
The advertiser is notified of the reason for cancellation.
The reporter is notified of the review outcome.

Scenario 5: (Report review — No violation found)
The review team examines the campaign.
No violation is found.
The temporary suspension is lifted.
The campaign becomes visible again.
The advertiser is notified that the campaign has resumed.
The reporter is notified of the review outcome.

Scenario 6: (Immediate automatic suspension)
Upon submission of the report, the campaign is immediately suspended (prior to review).
The advertiser sees the status: "Under review due to a report."
It is not visible to content creators.



Scenario 7: (Advertiser Notification upon Reporting)
When a campaign is paused due to a report, the advertiser is notified:
"Your campaign has been paused due to a report. It will be reviewed within 24 hours."

Scenario 8: (Report Statistics)
The admin dashboard displays statistics: number of reports, paused campaigns, and average review time.


Acceptance Criteria
Any user (advertiser, content creator, or visitor) can report a campaign or a clip.
Reporting requires selecting a reason (from a predefined list) with the option to add details.
Upon submission of a report, the campaign is automatically paused (becoming invisible to content creators).
The review team is notified immediately.
The advertiser is notified that the campaign has been paused.
Repeated reporting of the same campaign by the same user is prevented.
The review team can confirm or reject the violation.
If the violation is confirmed: The campaign is permanently cancelled, and the advertiser is notified.
If no violation is found: The pause is lifted, and the advertiser is notified.
All reports are logged in the database along with their status.
The reporter is notified of the review outcome.
The platform supports reporting by visitors (via email or login).


Tasks
UI/UX (Figma)
Design the "Report" button on the campaign card and details page.
Design the reporting modal (reason selection, additional details).
Design the report confirmation message.
Design a "Paused" badge for paused campaigns. Design email notifications (for the advertiser, reporter, and review team)
Design the report management dashboard (for the review team).
Mobile-responsive design.

Frontend
Build the report button and reporting modal.
Build the report form with reason selection.
Build the confirmation message.
Build the "Suspended" badge for the campaign card.
Build the report management dashboard (for reviewers).
Integrate with the backend API.

Backend
Create API to report a campaign: POST /api/campaigns/{id}/report
Create API to report a clip: POST /api/clips/{id}/report
Implement automatic campaign suspension upon reporting.
Create API to accept/reject a report (for reviewers): PUT /api/reports/{id}
Create API to fetch reports (for reviewers): GET /api/reports
Send notifications to the advertiser, reporter, and review team.
Prevent duplicate reporting.

Database
Create `reports` table:
id (UUID, PK)
reporter_id (UUID, FK to users; nullable for visitors)
reporter_email (VARCHAR, nullable)
campaign_id (UUID, FK, nullable)
clip_id (UUID, FK, nullable)
reason (ENUM: SEXUAL_CONTENT, GAMBLING, EXPLICIT_MUSIC, SUSPICIOUS_CURRENCIES, FALSE_CLAIMS, OTHER)
details (TEXT, nullable)
status (ENUM: PENDING, REVIEWED, RESOLVED, DISMISSED)
reviewed_by (UUID, FK to users, nullable)
reviewed_at (TIMESTAMP, nullable)
action_taken (VARCHAR, nullable)
created_at (TIMESTAMP)
Add `is_suspended` and `suspension_reason` columns to the `campaigns` table. Add indexes on `campaign_id`, `status`, and `created_at`.




AI Engineer (Optional)
Analyze reports to detect patterns.
Automatically categorize reports based on severity.
Suggest resolutions to reviewers based on past reports.

US-DISCOVER-03: Apply to Campaigns
Story ID: US-DISCOVER-02
Requirements: R2.04
Priority: High
Sprint: Sprint 4

User Story
"As a content creator, I want to apply to campaigns that interest me so that I can participate in sponsored content opportunities."

Scenarios
Scenario 1: (Happy Path — Applying to a campaign)
The content creator views campaign details.
Clicks the "Apply Now" button.
A confirmation window appears: "Are you sure you want to apply for this campaign?"
Clicks "Confirm".
The system adds them to the list of applicants.
A message appears: "Your application has been submitted successfully. You will be notified upon approval."
The advertiser is notified of the new applicant.
The campaign appears in the "My Applications" section with the status "Under Review".

Scenario 2: (Applying for a paused campaign)
The content creator attempts to apply for a paused campaign (due to a report).
The system blocks the action and displays: "This campaign is currently unavailable."

Scenario 3: (Duplicate application)
The content creator attempts to apply for the same campaign twice.
The system blocks the action and displays: "You have already applied for this campaign."

Scenario 4: (Withdrawing an application)
The content creator wishes to withdraw their application before approval.
Clicks "Withdraw Application".
The system cancels the application.

Scenario 5: (Approval notification)
The advertiser approves the application.
The content creator is notified: "Your application for Campaign X has been accepted. You can now download the materials and get started."
The application status changes to "Accepted". 



Scenario 6: (Rejection Notification)
The advertiser rejects the application.
The content creator is notified: "We regret to inform you that your application for Campaign X has been rejected.
The application status changes to "Rejected."

Scenario 7: (Applying to a campaign with an applicant limit)
The campaign has a maximum limit (e.g., 50 applicants).
If the limit is reached, applying is not possible.
Message displayed: "Maximum number of applicants reached."

Scenario 8: (Applying to a campaign with specific requirements)
The campaign requires a minimum follower count or a specific rating.
If the content creator does not meet the requirements, the message displayed is: "You do not meet the requirements for this campaign."

Acceptance Criteria
Content creators can apply to any active campaign (not paused or completed).
Application is made via a single click ("Apply Now" button).
An introductory message can be added (optional).
The advertiser is notified of a new applicant.
The content creator is notified upon approval or rejection.
Applications can be withdrawn prior to approval.
Duplicate applications for the same campaign are not allowed.
Applications cannot be submitted for paused or completed campaigns.
Campaign requirements (minimum followers, rating) are enforced.
Application status is displayed in the "My Applications" section.
All applications are recorded in the database.

Tasks
UI/UX (Figma)
Design the "Apply Now" button for the campaign card and details page.
Design the application confirmation modal/window.
Design the application form, including the optional message field. Design "Pending," "Accepted," and "Rejected" status indicators.
Design the "My Applications" section in the content creator dashboard.
Design email notifications.
Responsive mobile design.

Frontend
Build the "Apply Now" button and confirmation modal.
Build the application form.
Build the "My Applications" section with status indicators.
Build the "Withdraw Application" button.
Integrate with the backend API.



Backend
Create API for campaign application: POST /api/campaigns/{id}/apply
Create API for withdrawing application: DELETE /api/applications/{id}
Create API to fetch content creator applications: GET /api/applications/my
Create API for advertisers to accept/reject applications: PUT /api/applications/{id}/status
Implement validation logic (limits, conditions).
Send notifications to the advertiser and content creator.
Prevent duplicate applications.

Database
Create `applications` table:
id (UUID, PK)
campaign_id (UUID, FK)
creator_id (UUID, FK to users)
message (TEXT, nullable)
status (ENUM: PENDING, ACCEPTED, REJECTED, WITHDRAWN)
applied_at (TIMESTAMP)
reviewed_at (TIMESTAMP, nullable)
reviewed_by (UUID, FK to users, nullable)
Add indexes on `campaign_id`, `creator_id`, and `status`.

AI Engineer (Optional)
Rank applicants based on advertiser preference.
Analyze content creator compatibility with the campaign.



US-DISCOVER-04: View Smart Recommendations
Story ID: US-DISCOVER-03
Requirements: R2.05
Priority: Medium
Sprint: Sprint 4

User Story
"As a content creator, I want to see smart recommendations for campaigns suited to my profile so that I can easily discover relevant opportunities."

Scenarios
Scenario 1: (Happy Path — Viewing Recommendations)
The content creator navigates to the home page or the "Suggested for You" section.
The system displays a list of suggested campaigns based on:
Audience geographic distribution.
Type of content produced.
Previous ratings.
Participation history.
Each campaign appears with a reason for the recommendation (e.g., "Because your audience is in Saudi Arabia" or "Because you produce 'clipping' content").

Scenario 2: (Updating Recommendations)
The content creator updates their profile (e.g., adds a new audience segment or changes content type).
The system automatically recalculates recommendations.
New recommendations appear.

Scenario 3: (No Recommendations)
No suitable campaigns are currently available.
The system displays: "No recommendations at the moment. Browse all campaigns."
"Browse All" button.

Scenario 4: (Customizing Recommendations)
The content creator can modify their preferences (interests, preferred content types).
The system uses these preferences to refine recommendations.

Acceptance Criteria
A "Suggested for You" section appears on the content creator's dashboard.
Recommendations are based on: audience distribution, content type, ratings, and posting history.
Each recommendation is displayed with a suggested reason.
Recommendations are updated when the profile changes.
Preferences can be customized to improve recommendations.
An empty state is displayed when there are no recommendations.
Recommendations
Recommendations can be saved to favorites.
Inappropriate recommendations can be reported.
Recommendations load within 2 seconds.

Tasks
UI/UX (Figma)
Design the "Recommended for You" section in the content creator dashboard.
Design a recommendation card including the reason for the recommendation.
Design the preference customization page.
Design the empty state.
Design a mobile-responsive layout.

Frontend
Build the "Recommended for You" section with a list of recommendations.
Build a recommendation card with the reason.
Build the preference customization page.
Build the empty state.
Integrate with the backend API.



Backend
Create an API to fetch recommendations: `GET /api/campaigns/recommendations`
Implement the recommendation algorithm (or call an AI service).
Create an API to update preferences: `PUT /api/creator/preferences`
Recalculate recommendations upon profile updates.

Database
Create the `creator_preferences` table:
`creator_id` (UUID, PK)
`preferred_content_types` (JSON)
`preferred_countries` (JSON)
`min_cpm` (DECIMAL)
`updated_at` (TIMESTAMP)
Add a `recommendation_score` column to the `campaigns` table (temporary).

AI Engineer
Build a recommendation model based on:
Content similarity (Content-based filtering).
Collaborative filtering.
Audience analysis.
Periodically update the model.

US-DISCOVER-05: Save Favorite Campaigns
Story ID: US-DISCOVER-04
Requirements: R2.06
Priority: Medium
Sprint: Sprint 4

User Story
"As a content creator, I want to save campaigns that interest me to my favorites so I can follow up on them later." Scenarios
Scenario 1: (Happy Path — Add to Favorites)
The content creator views a campaign.
They click the heart icon (❤️) or "Save."
The campaign is added to favorites.
A message appears: "Added to favorites."
The campaign appears in the "Favorites" section.

Scenario 2: (Remove from Favorites)
The content creator clicks the heart icon again.
The campaign is removed from favorites.
A message appears: "Removed from favorites."




Scenario 3: (View Favorites List)
The content creator navigates to the "Favorites" section.
They view all saved campaign
They can sort and filter the list.

Scenario 4: (Notification on Campaign Status Change)
A favorited campaign is paused or completed.
The content creator is notified: "Campaign X in your favorites is no longer available."

Scenario 5: (Empty State)
There are no campaigns in favorites.
Display: "No campaigns in favorites. Start exploring campaigns."
"Discover Campaigns" button.

Acceptance Criteria
The content creator can add any campaign to favorites.
A campaign can be removed from favorites.
The favorites list appears in the dashboard. Sorting and filtering are available in the favorites list.
Content creators are notified when the status of a favorited campaign changes.
Items can be saved directly from the recommendations list.
Bulk deletion is supported.
An "empty state" is displayed when there are no favorites.
Favorites are stored in the database.

Tasks
UI/UX (Figma)
Design the heart icon (filled/empty) for the campaign card.
Design the "Save" button on the details page.
Design the "Favorites" section in the dashboard.
Design confirmation messages.
Design the empty state.
Design a mobile-responsive layout.

Frontend
Implement the heart icon with toggle functionality.
Implement the "Save" button on the details page.
Implement the favorites section.
Implement the bulk deletion feature.
Integrate with the backend API.

Backend
Create API to add to favorites: POST /api/favorites
Create API to remove from favorites: DELETE /api/favorites/{id}
Create API to fetch favorites: GET /api/favorites
Send notifications when a favorited campaign's status changes.


Database
Create the `favorites` table:
id (UUID, PK)
creator_id (UUID, FK to users)
campaign_id (UUID, FK)
created_at (TIMESTAMP)
Add an index on `creator_id` and `campaign_id`.

AI Engineer (Optional)
Analyze favorited campaigns to provide better recommendations.

