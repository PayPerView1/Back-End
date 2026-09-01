# Software Requirements Specification (SRS)

# Pay Per View

> **Document purpose:** Define the requirements, scope, stakeholders, architecture direction, functional requirements, and non-functional requirements for the **Pay Per View** platform.
>
> **Reading convention:** Requirement identifiers such as `R1.01` and `NFR4.01` are preserved as the primary references for implementation, testing, and AI-assisted analysis.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
   - 1.1 Introduction
   - 1.2 Problem Statement
   - 1.3 Project Objectives
   - 1.4 Project Limitations
   - 1.5 Project Scope
   - 1.6 Project Stages
   - 1.7 Stakeholder Analysis
   - 1.8 Tools & Equipment
2. Functional Requirements
3. Non-Functional Requirements

---


---

# 1. Project Overview

## 1.1 Introduction
In recent years, the growth of short-form video content on platforms such as TikTok, Instagram Reels, and YouTube Shorts has created a massive demand for brands to distribute their message through organic, creator-driven content rather than traditional advertising. At the same time, a large community of content creators ("clippers") is seeking reliable ways to monetize their editing and publishing skills without needing a large following or professional production experience.
This project introduces a digital marketplace platform designed to connect two sides: brands, stores, and public figures (collectively referred to as "brands" throughout this document)  who want to distribute their content widely, and content creators who want to earn income by clipping, editing, and publishing short-form videos and UGC (User-Generated Content) based on that content. The platform operates on a Pay-Per-View (CPM) model, where brands set a campaign budget and a price per 1,000 verified views, while creators produce and publish content in return for automatic, performance-based payouts.
What distinguishes this platform is its dual geographic scope, covering both Arab and global brands and creators in one marketplace, its comprehensive support for multiple content formats (clipping, UGC, slideshow, audio-only, logo placement), and most importantly, its commitment to a strict "Halal Content" standard that filters out gambling, inappropriate, or misleading campaigns — a gap that no existing platform, whether global or regional, currently addresses.
The platform leverages modern technologies to build a minimum viable product (MVP) that supports bilingual use (Arabic/English with full RTL support), campaign creation and review tools, view-verification systems, and regional payment integration. It is designed for future scalability, including AI-based fraud detection, in-platform editing tools, and mobile applications.
This project is particularly relevant today, as brands increasingly move away from costly traditional advertising toward organic, trust-based content distribution, while creators — especially those in the Arab world — seek income opportunities that align with their values and are currently underserved by existing platforms.

## 1.2 Problem Statement
Existing clipping and UGC platforms, most notably Content Rewards (built on the Whop infrastructure), are primarily designed for a global, unfiltered market and do not cater to the unique needs of Arab brands, creators, or users seeking ethically screened content. These platforms lack essential trust, localization, and content-integrity features. As a result, brands struggle to find a reliable, values-aligned distribution channel, while creators face difficulty finding trustworthy campaigns that match their content and ethical standards. Key issues include:

- **No unified marketplace** that brings together Arab and global brand campaigns with all content formats (clipping, UGC, slideshow, audio, logo placement) in one place.
- **Limited trust mechanisms**, including unverified or bot-inflated view counts and payouts issued before proper verification.
- **No content-screening standard**, with gambling, betting, and inappropriate campaigns mixed alongside regular ones — a major complaint among both brands and creators.
- **Lack of geographic targeting tools**, leaving views and audiences essentially anonymous and unmeasurable by region.
- **No real localization** for the Arab market, including language, regional payment methods (mada, STC Pay), and cultural content norms.

This project aims to bridge these gaps by developing a two-sided marketplace that combines **comprehensive content-type support, dual Arab/global reach, and a verified "Halal Content" standard**, empowering brands and creators alike while building the trust that current platforms consistently fail to provide.

## 1.3 Project Objectives
The main objective of this project is to develop a reliable, Sharia-compliant central platform that connects brands with content creators through a pay-per-view model for videos related to specific campaigns. This allows companies to promote their products while enabling content creators to earn income based on verified video views.
The project aims to achieve the following objectives:
**• Connecting Brands with Content Creators:** Providing a central, Sharia-compliant platform where companies can launch marketing campaigns, and content creators can participate by producing and publishing promotional content.
**• Supporting Multiple Content Types:** Enabling marketing campaigns for various content types, including short videos, user-generated content, audio promotions, and other short-form content.
**• Ensuring Fair and Transparent Payments:** Implementing a verified mechanism for calculating views, calculating content creators' earnings using a cost-per-thousand-views model based on valid and verified views.
**• Reduce fraudulent activity:** Use AI-powered fraud detection, along with manual review of suspicious cases, to minimize fake views, protect advertiser budgets, and ensure campaign performance credibility.
**• Support Arab and global markets:** Provide local and international brands and content creators with a multilingual platform and flexible payment options.
**• Promote ethical advertising:** Implement an AI-powered halal content screening system that automatically categorizes campaigns as approved, rejected, or flagged for manual review before publication, ensuring compliance with the platform's ethical standards.

**• Provide performance analytics:** Offer dashboards for brands and content creators to monitor campaign performance, verified views, cost per mille (CPM), engagement statistics, and real-time campaign progress.

**• Develop a scalable architecture:** The system is designed with a modular architecture that supports future integration with advanced AI models, additional social media platforms, automated payment gateways, and enhanced fraud detection capabilities.

## 1.4 Project Limitations
While the proposed platform offers a comprehensive solution for performance-based content marketing, the initial release (the minimum viable product) has several limitations:
**• Limited Platform Support:** The initial release will support only select social media platforms, such as TikTok, Instagram Reels, and YouTube Shorts.
**• Manual Suspicious Case Verification:** Although AI is used to detect potentially fraudulent views, suspicious campaigns will require manual review before creators are paid.
**• Basic Fraud Detection:** The initial fraud detection mechanism relies on predefined rules and AI-powered analysis. Advanced behavioral analysis models will be introduced in later releases once sufficient historical data is available.
**• Limited Payment Methods:** A limited number of payment gateways will be supported initially, with plans to add more payment options in later releases.
**• Content moderation:** Campaigns rely on predefined ethical guidelines and human oversight of borderline cases, which may lead to processing delays during peak campaign periods. 
**• AI screening scope:** In the beta version, AI-powered content screening is limited to analyzing campaign text, descriptions, and metadata. This release does not include full video content analysis or advanced visual recognition.
**• No built-in video editing tools:** The platform does not offer built-in video editing capabilities; content creators must use third-party editing software before uploading content.
**• Web-only platform (beta):** The initial release will be available as a responsive web application, while dedicated Android and iOS apps will be developed in later phases.

## 1.5 Project Scope

- ### The targeted Audience scope:

**Brands and Advertisers:**
 Companies, e-commerce stores, startups, and public figures—both from the Arab region and internationally—who want to distribute their marketing content across social media platforms (TikTok, Instagram Reels, and YouTube Shorts). Advertisers pay creators based on verified views (CPM) while ensuring that all campaigns comply with the platform's **Halal Content Policy**.

 **Content Creators (Clippers/Creators):**
 Individuals who wish to earn income by editing, clipping, and publishing short-form videos, creating user-generated content (UGC), slideshows, or voice-over content using source materials provided by brands. Creators participate in categorized campaigns that are ethically and religiously compliant according to the platform's content guidelines.

- ### Geographic Scope

The platform serves both **Arab and international markets**, allowing campaigns and users from different countries to interact within a single ecosystem rather than being limited to a specific region, as is common with many competing platforms.
Each content creator is categorized based on their audience's geographic distribution, enabling advertisers to target campaigns more accurately and reach their desired markets.

-  ### Platform and Device Scope

 **Responsive Web Application:**
 The platform is developed as a responsive web application that supports both **Arabic (with full RTL support)** and **English**, ensuring compatibility across major desktop and mobile web browsers.

 **Backend Infrastructure:**
 The backend is built using **Node.js**, **Express.js**, and **MongoDB** to manage user accounts, campaigns, content submissions, payments, and platform operations. It also integrates with the official APIs of social media platforms (TikTok, Instagram, and YouTube) to retrieve verified view statistics and validate campaign performance. Additionally, the backend communicates with a dedicated AI microservice for content policy verification, image analysis, and fraud detection.

## 1.6 Project Stages

   Choosing the right development model is crucial for an efficient engineering process. This project adopts an (Iterative Modular Development Approach) based on Agile principles. Given that the platform operates as a multi-role digital marketplace—connecting brands and content creators with content verification and automated wallet updates—breaking development into focused iterations ensures code quality, maintainability, and a fully functional MVP.

-   ### Why the Iterative Modular Approach?

- Incremental Progress: Core features (Auth, Campaigns) are stabilized before adding complex logic.
- Manageable Complexity: Decoupling modules (Brands, Creators, Admin, Finance, AI) keeps architecture clean.
- Risk Mitigation: Financial logic and content moderation are tested early in the lifecycle.
- Agile Adaptability: Allows structured sprint tracking and rapid bug resolution.

### Project Development Stages
** 1. Requirement Analysis & Planning**
- Define functional requirements for Brands, Creators (Clippers), and Admins.
- Establish strict moderation rules for the "Halal Content" policy.
- Map system workflows, ERD diagrams, and RESTful API endpoints.
- Identify AI integration points: campaign text screening, clip moderation (visual/audio), fraud detection, and smart matching.
- Define AI success metrics (accuracy thresholds, latency targets)
** 2. System Design**
- Define system architecture, DB schema (PostgreSQL/MongoDB), and API structures.
- Create wireframes for Campaign Management, Clip Discovery, and Moderation dashboards.
- Design data flows for submission verification and wallet updates.
- AI Layer Design:
  - Build AI microservice using Python + FastAPI.
  - Integrate LLM models (via LangChain) for intelligent content understanding and brief analysis.
  - Implement RAG (Retrieval-Augmented Generation) with Vector DB for retrieving Halal policy guidelines and past moderation decisions to assist LLM reasoning.
  - Use scikit-learn for anomaly detection (fraud view patterns).
  - Design moderation pipeline: AI pre-screening → Human review for flagged items.

** 3. Development Phase**
Integrates backend, database, frontend dashboards, and AI services:
Backend (Node.js/Express):
- Handles JWT authentication, RBAC, campaign APIs, submission workflows, and payout calculations.
- Orchestrates AI service calls for content screening and fraud checks.
AI Services (Python/FastAPI):
- Content Moderation: Uses LLM + RAG (with Vector DB for policy retrieval) to classify campaign descriptions, clip captions, and briefs against Halal guidelines.
- Visual/Audio Analysis: Employs LLM-based multimodal understanding or computer vision models for clip screening.
- Fraud Detection: Leverages scikit-learn models to detect bot traffic and anomalous view patterns.
- Smart Matching (Phase 2+): Uses LangChain agents to match creators with relevant campaigns.
Database Layer:
- Manages profiles, campaigns, submission states (pending, AI\_reviewed, approved, rejected), and wallet transactions.
- Stores moderation logs and AI confidence scores for audit trails.
Frontend Dashboards:
- Brands: campaign creation (with AI-assisted brief suggestions), review dashboard.
- Creators: clip submissions, earnings dashboard.
- Admins: content moderation with AI-flagged priority queue.

** 4. Testing & Quality Assurance**
- Conduct API testing using Postman.
- Execute end-to-end testing (Campaign Creation → Moderation → Submission → Approval → Wallet Update\*).
- Test edge cases (budget limits, invalid URLs).
- AI Validation: Test moderation accuracy on labeled datasets, evaluate fraud detection precision/recall, and measure inference latency.
- Run adversarial tests with borderline Halal content to ensure model robustness.

** 5. Deployment & Integration**
- Deploy application and database to cloud hosting (e.g., Render/Railway/AWS).
- Containerize AI services using Docker for scalability.
- Secure environment variables (.env) and populate realistic demonstration data.
- Integrate with TikTok/Instagram/YouTube APIs for view verification.
- Implement fallback: if AI service fails, route content to human review queue.

** 6. Documentation & Maintenance**
- Produce technical documentation (API specs, README, deployment guides).
- Document AI pipeline: model architecture, training data, retraining procedures.
- Implement feedback loop: human moderation decisions feed back to improve AI models.
- Refine code structure for future scalability (advanced AI features, multi-language support).

## 1.8 Tools & Equipment
**Hardware**:
**Laptop 1:** 11th Gen Intel®️ Core™️ i5-1135G7 (2.40 GHz, 4 Cores / 8 Threads), 16GB DDR4 RAM, 256GB SSD, NVIDIA Graphics Card (2GB), running Microsoft Windows 11 Pro.
**Laptop 2:** 10th Gen Intel®️ Core™️ i5-10500H CPU @ 2.50GHz, 8GB DDR4 RAM, 256GB NVMe SSD, NVIDIA GeForce GTX 1650 with Max-Q Design, Intel®️ UHD Graphics, running Windows 11.
**Laptop 3**: AMD Ryzen 7 3700U with Radeon Vega Mobile Gfx (2.30 GHz), 16.0 GB RAM (13.9 GB usable), 64-bit operating system, x64-basedprocessor, running Windows.
**Laptop 4**: 12th Gen Intel®️ Core™️ i5-12500H (3.10 GHz), 16.0 GB RAM (15.7 GB usable), NVIDIA GeForce RTX 3050 Laptop GPU (4 GB) + Intel®️ Iris®️ Xe Graphics (128 MB), Storage (943 GB total / 727 GB used), 64-bit operating system, x64-based processor, running Windows.
**Laptop 5**: Intel®️ Core™️ i7-11800H CPU @ 2.30GHz, 16GB DDR4 3200MHz RAM, 512GB NVMe SSD, NVIDIA GeForce RTX 3050 Laptop GPU (Dedicated) + Intel®️ UHD Graphics (Integrated), running Windows 11.
**Laptop 6**: 13th Gen Intel®️ Core™️ i7-13620H (2.40 GHz), 16GB RAM, 477GB storage (NVMe), NVIDIA GeForce RTX 4050 Laptop GPU (6GB) + Intel®️ UHD Graphics, running Windows 11 Home.
**Laptop 7**: 10th Gen Intel®️ Core™️ i7-1065G7 (1.30 GHz, 4C/8T), 8GB RAM, Intel®️ Iris®️ Plus Graphics, running Windows 10.
**Software**:
**Frontend Tools:**
**Next.js**: React framework for building the user interface.
**Tailwind CSS**: Utility-first CSS framework for styling.
**Backend Tools**:
**Node.js**: JavaScript runtime for backend logic.
**Express.js**: Web framework for building APIs.
**MongoDB**: NoSQL database for data storage.
**JWT**: JSON Web Tokens for secure authentication.
**Docker**: Containerization for application deployment.
**AI & Machine Learning Tools:**
**Python**: Core programming language for AI and data science.
**LangChain**: Framework for developing applications with LLMs.
**RAG (Retrieval-Augmented Generation):** Enhances model responses with accurate knowledge retrieval. 
**Vector** **Database**: Stores and retrieves vector embeddings for semantic search and similarity matching. 
**LLM Model**:Large language models used for generative and analytical AI tasks. 
**Computer Vision API**: Handles image and video processing and visual content analysis. 
**Scikit-learn:** Machine learning library used for building predictive and classification models.
**FastAPI**: High-performance Python framework for building and serving AI microservices. 
**UI/UX Design Tools:**
**Figma**: Collaborative interface design and prototyping tool.
**Development & Testing Tools:**
**Postman**: API testing and debugging.
**Git & GitHub**: Version control and collaboration.
**VS Code**: IDE for Next.js, Node.js, and Python development.
**Docker Desktop**: Local container testing and environment management.

## 1.7 Stakeholder Analysis
### Primary Stakeholders
**1-Brands / Advertisers**
**Description:**
Companies, e-commerce stores, startups, public figures, government entities, and organizations that want to promote their products/services through short video content.
**Key Needs:**
•  Reaching a broad and targeted audience at a lower cost compared to paid advertising.
•  Ensuring their content is displayed in a clean (halal) environment that does not conflict with their values.
•  Precise knowledge of viewers' nationality/country (geographic targeting).
•  Transparent reports on the number of views and actual cost.
•  Reduced administrative burden (campaign management, video review, communication with clip creators).
•  Ability to reuse the produced content in future campaigns.
•  Fastest campaign launch time (days instead of weeks).

**2-Content Creators (Clips/Creators)**
**Description:**
Individuals with active accounts on TikTok, Instagram Reels, and YouTube Shorts, who have an audience and want to earn extra income by editing, animating, and publishing short videos or creating UGC content.

**Essential needs:**
•         	Real and consistent income opportunities (constantly available campaigns).
•         	A simple and quick way to register and get started (no large follower count required).
•         	Prior knowledge of the type of content required and a clear reward (price per 1000 views).
•         	A reliable and fast payment system (digital wallets, bank transfer, PayPal, STC Pay, Mada).
•         	A good rating and reputation that unlocks better campaigns (Tiers system).
•         	Campaigns classified as "Halal" to ensure they are not promoting prohibited products (gambling, alcohol, usury).

**3-Management & Moderation Team**
**Description:**
An internal team that manages the platform, reviews campaigns, resolves disputes, and ensures policy compliance.

**Key Needs:**
• 	Simplified management tools for quickly reviewing campaigns and clips.
•         	A fast reporting system for detecting violations.
•         	Analytical reports on platform performance (number of campaigns, amounts paid, number of active clippers).
•         	The ability to immediately suspend or remove any campaign or clip that violates the rules.
•         	Communication channels with brands and clippers to resolve issues.

### Secondary Stakeholders
**1- Investors/Sponsors**
**Description:**
Individuals, investment funds, or government entities that finance the platform's development and expansion, expecting a return on investment (ROI).

**Requirements:**
•         	A clear business plan and a profitable revenue model (commission per campaign).
•         	Key Performance Indicators (KPIs): Number of active users, financial trading volume, retention rate.
•         	A defensible competitive advantage to protect the platform from competitors (here: the "Halal" standard).
•         	An expansion plan (first the Arab market, then the global market).
•         	Regular financial reports.

**2-Technology and Infrastructure Providers**
Description:
Cloud service providers (AWS, Google Cloud, Firebase), social media platform API providers (TikTok, Instagram, YouTube), analytics companies (Google Analytics, Mixpanel).

Contact Key Points:
•         	Reliable and consistent use of APIs.
•         	Compliance with terms of service (privacy, request rate).
•         	Timely billing.

**3-Local Authorities and Regulatory Bodies**
Description:
Ministries of Economy, advertising regulatory bodies, data protection authorities (such as GDPR in Europe and local authorities in Arab countries), and possibly religious advisory or Sharia supervisory bodies.
Requirements:
•         	Platform compliance with personal data protection laws.
•         	Clear mechanism for handling infringing content.
•         	Published privacy policy and terms of service.
•         	If a Sharia supervisory body exists: Platform's actual adherence to halal content guidelines, not just marketing claims.

### Third-Party Stakeholders
**1-Social Media Platforms**
**Description:**
TikTok, Instagram, YouTube, Snapchat, and others.

**Requirements:**
•         	Use their APIs according to their terms of service.
•         	Do not manipulate viewership data.
•         	Pay advertising fees if using their paid tools.

**2-Competitors**
**Description:**
Platforms such as Content Rewards, FindClout, Arabic Clipping, UGCeer, and others.
** Market Position & Interests:**
•  Maintaining their market share.
•  Monitoring the new platform to identify its strengths and weaknesses.

**3- Media & Tech Influencers**
**Description:**
Tech journalists, bloggers, and YouTubers discussing startup projects and Creator Economy platforms.

**Needs:**
•         	Distinguished success stories and real figures to share.
•         	Interviews with founders.

**4- Local & Arab Community**
**Description:**
The Arab community in general, which seeks ethical alternatives in the world of digital content and desires to support local projects.
**Needs:**
•         	A platform that reflects their values and respects their cultural and religious sensitivities.
•         	Supporting the local economy by empowering Arab content creators and Arab brands. 


---

# 2. Functional Requirements
## 2.1 General Requirements (All Users)
**R0.01** Create an account: The user creates a new account using their email address and password.
**R0.02** Log in: The user logs in using their email address and password.
**R0.03** Choose Account Type: During registration, the user selects their account type: (a) Brand/Advertiser or (b) Content Creator/Clipper.
**R0.04** Set Up Profile: The user completes their profile information, including: full name, profile picture (or brand logo), email address, phone number, and country/city.
**R0.05** Update Profile: The user modifies their profile information at any time (name, picture, phone number, email address, and country).
**R0.06** Change Password: The user changes their password by entering their current password and then their new password, confirming it, and verifying that it matches and complies with security policies.
**R0.07** Password Reset: The user requests a password reset by entering their registered email address. The system then sends a reset link to that email.
**R0.08** Log Out: The user logs out of their account, and the session is securely terminated.
**R0.09** Email Verification: Upon registering with an email address, the system sends an activation link to the registered email. The user cannot use the account until activation is complete.
**R0.10** Automatic Deletion of Inactive Accounts: The system automatically deletes accounts that have been inactive for six months, sending a warning notification 30 days prior to deletion.

## 2.2 Brand / Advertiser Requirements
### 2.2.1 Campaign Management
**R1.01** Creating a New Campaign: The advertiser creates a new campaign by filling out a form containing: the campaign name, total budget, CPM (cost per thousand views), the type of content required, and uploading source materials (raw videos, images, text).
**R1.02** Determining the Required Content Type: The advertiser selects from the following content types: (Clipping - Full UGC - Slideshow - Audio Only - Logo Support - Public Figure Content).
**R1.03** Writing the Creative Brief: The advertiser writes clear instructions for content creators, including: the main idea, desired tone, key messages, keywords, and visual references, if applicable.
**R1.04** Defining the Target Audience Geographically: The advertiser specifies the target countries/regions for views. The campaign will only be shown to content creators who have an audience in these regions.
**R1.05** Defining the Campaign's Sharia Compliance: The advertiser signs/declares that the campaign content adheres to the "Halal Content" policy through a mandatory form that includes: (No gambling, no sexual content, no explicit music, no alcoholic beverages, no suspicious currencies, no unrealistic profit claims).
**R1.06** Attaching Source Material Files: The advertiser uploads source material, which may include raw video footage, images, text, approved background music, and brand logos.
**R1.07** Saving Campaign as a Draft: The system allows the advertiser to save the campaign as a draft before publishing, to return to it later and edit it.
**R1.08** Submitting Campaign for Review: After all data is complete, the advertiser submits the campaign for review, and it moves to the "Pending Review" status.
**R1.09** Reviewing Previous Campaigns: The system displays a list of all the advertiser's previous campaigns with their status (Pending Review, Active, Completed, Cancelled, Rejected) and allows searching and filtering.
**R1.10** Copying a Previous Campaign: The system allows the advertiser to copy a previous campaign (with the same settings) to quickly create a new campaign, with the ability to edit the data before publishing.

### 2.2.2 Reviewing and Managing Content Creators’ Videos
**R1.11** Reviewing Submitted Videos: The system displays all videos submitted by content creators for the campaign, along with the status of each video (Under Review, Accepted, Rejected, Pending).
**R1.12** Reviewing a Video: The system allows the advertiser to view the entire video, view the content creator's details (name, number of followers, geographic audience distribution), and the link to the post on the social media platform.
**R1.13** Accepting a Video: The advertiser accepts the video, and the views are automatically credited to the content creator (tracking begins immediately upon acceptance).
**R1.14** Rejecting a Video with a Reason: The advertiser rejects the video, providing a reason for rejection (e.g., does not adhere to the brief, low quality, contains inappropriate content).
**R1.15** Requesting Video Edits: The advertiser requests edits to the video, providing specific instructions. The video is then returned to the content creator for revisions.
**R1.16** Bulk Approval: The system allows the advertiser to approve or reject multiple videos simultaneously to save time.
**R1.17** Setting a Minimum Video Quality Requirement: The advertiser sets a minimum average rating or number of followers for content creators who can apply for their campaign.

### 2.2.3 Performance Reports and Analytics
**R1.18** Displaying Campaign Performance Report: The system displays a comprehensive report for each campaign containing: total views, number of approved videos, number of participating content creators, amount spent, and remaining budget.
**R1.19** Displaying Geographic View Distribution: The system displays a map or graph showing the countries from which views for each campaign originated.
**R1.20** Displaying Video Performance Details: The system displays for each video: the number of views, the number of interactions (likes, comments, shares), and the amount due to the content creator.
**R1.21** Exporting Reports: The system allows the advertiser to export campaign reports in PDF or Excel format to share with the team.
**R1.22** Displaying Performance Forecasts: The system displays an estimate of the expected number of views based on the performance of participating content creators and the target audience.

### 2.2.4 Budget and Payments
**R1.23** Funding: The advertiser funds their e-wallet via available payment gateways (Mada, STC Pay, PayPal, bank transfer) to use for campaign funding.
**R1.24** Setting a Daily Budget Limit: The advertiser sets a maximum daily spending limit for the campaign to avoid exceeding the budget.
**R1.25** Automatically Pausing the Campaign When the Budget Runs Out: The campaign is automatically paused for content creators when the allocated budget is exhausted.
**R1.26** Recharging the Campaign: The system allows the advertiser to add an additional budget to an active or inactive campaign with a single click.
**R1.27** Viewing Transaction History: The system displays a complete history of all fund transfers and withdrawals, including the dates and status of each transaction.
**R1.28** Refunding Unused Balance: The system allows the advertiser to request a refund of the remaining balance in their wallet (after deducting any processing fees).

## 2.3 Content Creator (Creator / Clipper) Requirements
### 2.3.1 Reviewing and Applying to Campaigns
**R2.01** Review of available campaigns: The system displays a list of all campaigns available to apply for, with the ability to search and filter by: content type, and target country.
**R2.02** Campaign Details Display: When a campaign is selected, the system displays full details including: campaign name, source materials, creative summary, cost per thousand impressions rate, remaining budget, and target countries.
**R2.03** Applying to a Campaign: The content creator clicks the "Apply Now" button to be added to the list of applicants for the campaign, awaiting approval from the advertiser or an automated system.
**R2.04** Automatically Reviewing Suitable Campaigns: The system displays intelligent campaign recommendations that match the content creator's profile based on: their geographic audience distribution, the type of content they produce, and their previous ratings.
**R2.05** Saving Favorite Campaigns: The system allows the content creator to save specific campaigns to follow later.
### 2.3.2 Content Production and Publishing
**R2.07** Downloading Source Materials: The system allows the content creator to download all source materials for the campaign they applied to and were accepted into.
**R2.08** Producing the Required Clip: The content creator produces the clip according to the brief and instructions provided by the advertiser.
**R2.09** Publishing the Clip on Their Account: The content creator publishes the clip on their account on one of the following social media platforms: (TikTok, Instagram Reels, YouTube Shorts).
**R2.10** Uploading the Post Link: The content creator uploads the link to the published post on the platform, which is then automatically verified and linked.
**R2.11** Keyword and Hashtag Setting: The content creator is required to add the keywords and hashtags specified by the advertiser in the post description.
**R2.12** Link Update for Reposting: The system allows the content creator to update the post link if they repost it or modify its settings.
### 2.3.3 Tracking Views and Earnings
**R2.14** Displaying the Number of Achieved Views: The system displays the actual number of views for the video (retrieved via the platform's API) in real time after the advertiser approves the video.
**R2.15** Displaying the Amount Due: The system displays the amount due to the content creator based on the number of views multiplied by the CPM rate, showing any discounts or commissions.
**R2.16** Notification Upon Reaching the Viewing Target: The system sends a notification to the content creator when their video reaches a specific number of views (e.g., 10K, 50K, 100K).
**R2.17** Displaying Geographical View Distribution: The system displays a breakdown of the countries from which the video views originated (to help improve future content).
### 2.3.4 Earnings and Withdrawals Wallet
**R2.18** View Earnings Wallet: The wallet displays: available balance, pending balance (under review/freeze period), and total earnings earned to date.
**R2.19** Request Withdrawal: The content creator requests to withdraw the available amount in their wallet, specifying their preferred payment method.
**R2.20** Select Payment Method: The content creator chooses their payment method from the available options: (PayPal, bank transfer, STC Pay, Mada, other digital wallets).
**R2.21** Minimum Withdrawal: The system sets a minimum withdrawal amount (e.g., $10 or its equivalent in local currency).
**R2.22** Payment History: The system displays a complete history of all withdrawals, including dates and statuses (processing, completed, failed).
**R2.23** Disbursement Notification: The system sends a notification to the content creator upon completion of the disbursement, detailing the amount and payment method

## 2.4 Trust, Moderation & Fraud Prevention
**R3.01** Pre-Publication Campaign Review: The internal review team reviews each new campaign before it is made visible to content creators to verify: (a) completeness of data, (b) compliance with the Halal Content Policy, (c) quality of source materials, and (d) clarity of the brief.
**R3.02** Campaign Classification System: When creating a campaign, the advertiser classifies it into specific categories: (Clipping, UGC, Slideshow, Audio, Logo, Mixed).

**R3.03** Reporting a Violating Campaign: The system allows any user (advertiser, clipper, visitor) to report a campaign or clip suspected of violating the Halal Content Policy, with the option to include the reason for the report.
**R3.04** Immediate Campaign Suspension Upon Report: Upon receiving a report about a campaign, the system automatically suspends the campaign (making it invisible to content creators) until it is reviewed by the review team. R3.05 Basic Fraud Detection System: The system performs an initial (rules-based) check of views before they are counted towards pay. This check considers factors such as: (a) abnormally rapid increase in views, (b) views from non-targeted countries, and (c) unusual account activity.
**R3.06** Collection Period Payments are held for 7 days after the views are calculated to allow for verification of view accuracy and detection of fraud.
**R3.07** Content Creator Tier System: This system categorizes content creators into levels (Gold, Silver, Bronze) based on: (a) historical view count, (b) quality of brief adherence, (c) advertiser ratings, and (d) no prior violations.
**R3.08** Geographic Audience Distribution: This feature displays the geographic distribution of a creator's audience as percentages (e.g., 60% Saudi Arabia, 20% Egypt, 10% UAE, 10% Other) and is automatically updated upon account linking.
**R3.09** Review Decision Documentation: The review team documents the reason for rejecting each campaign in an internal log, which can be accessed when needed (for regulatory bodies or to resolve disputes).
**R3.10** Advertiser Rating System: The system allows content creators to rate advertisers after the campaign ends (based on: clarity of instructions, speed of approval, and cooperation).

## 2.5 Infrastructure & Operations Requirements
**R4.01** Bilingual Support (Arabic and English): The interface is available in both Arabic (with full RTL support) and English, and users can easily switch between them.
**R4.**02 Clear Commission System: The commission percentage taken by the platform from each campaign is clearly displayed at all stages of campaign creation and progress, with no hidden fees.

**R4.03** Multiple Payment Gateways: The system supports local (Mada, STC Pay, local bank transfer) and international (PayPal, Stripe, credit cards) payment gateways to facilitate deposits and withdrawals.
**R4.04** Integrated Notification System: The system sends notifications via email, in-app notifications, and mobile notifications to users upon campaign acceptance, clip rejection, view attainment, earnings payout, and other important events.
**R4.05** Archiving of Completed Campaigns: Completed campaigns are archived and remain available to advertisers for reporting and analytics even after the budget has expired.
**R4.06** Periodic Backup: The system performs a full database backup daily, retaining copies for 30 days.
**R4.07** Privacy Policy and Terms of Service: The Privacy Policy and Terms of Service are clearly available and readable on a separate page and are accepted by the user upon registration.

## 2.6 Requirements Outside the MVP Scope
**R5.01** Advanced AI Fraud Detection: This will be developed in later phases, starting with a simplified, rules-based system in the initial release
**R5.02** An advanced "Tiers" program with progressive advantages will be activated after sufficient data on content creator performance is collected.
**R5.03** Integration with additional social media platforms (Snapchat, Twitter/X) will begin with support for TikTok, Instagram, and YouTube only, with expansion to follow later.
**R5.04** An AI-powered smart campaign recommendation system will be developed after sufficient data on user preferences and performance is collected.


---

# 3. Non-Functional Requirements
## 3.1 Performance Requirements
**NFR1.01** Page Load Time The page load time on the platform should not exceed 3 seconds under normal network conditions (4G/5G internet connection or a stable 10 Mbps connection).
**NFR1.02** Concurrent User Support The platform should support a minimum of 5,000 concurrent users in the initial release, with the potential to scale to 50,000 users within the first year of launch.
**NFR1.03** Peak Time Request Handling The platform should handle 1,000 requests per minute (e.g., campaign creation, campaign submission, video upload, withdrawal request) during peak times without performance degradation.
**NFR1.04** Real-Time Data Synchronization Time-sensitive data (e.g., view count updates, campaign status, order notifications) must be synchronized within 5 seconds of the event occurring on the server.
**NFR1.05** API Response Time The average response time of APIs must be less than 500 milliseconds for simple requests (e.g., fetching a campaign list) and less than 2 seconds for complex requests (e.g., fetching a full campaign performance report).
**NFR1.06** Payment Processing Performance  Payment processes (shipping, withdrawals, verifications) must be completed within 10 seconds of initiation, with the process status clearly displayed to the user.
**NFR1.07** API View Fetching Performance View data from social media platforms (TikTok, Instagram, YouTube) must be fetched within a maximum of 30 seconds per video, with automatic retry in case of connection failure.

## 3.2 Scalability Requirements
**NFR2.01** Horizontal Scaling  The platform infrastructure must be horizontally scalable (adding additional servers) to support growth from 1,000 to 100,000 users within the first two years of operation, without requiring any fundamental changes to the code.
**NFR2.02** Database Scaling The database must support up to 1 million records (campaigns, clips, users, financial transactions) in the first year, while maintaining a query performance of less than 1 second for basic queries.
**NFR2.03** File Storage Scaling The platform must support increasing file storage capacity (videos, images, source materials) to 1 TB in the first year, with the ability to expand as needed.
**NFR2.04** Adding New Features The software architecture must be modular to allow for the addition of new features (such as AI-powered fraud detection, mobile applications, and integration with new platforms) without affecting existing features or requiring system rewriting.
**NFR2.05** Support for New Markets The system must be geographically scalable to support new markets (additional Arab countries, European markets, and Asian markets) with new language, currency, and regulatory requirements, without fundamental system changes.

## 3.3 Reliability & Availability Requirements
**NFR3.01** Uptime The platform must have at least 99.5% uptime (equivalent to a maximum of 3.6 hours of downtime per year), with a focus on peak periods (business hours, Ramadan, shopping seasons).
**NFR3.02** Recovery Time The system must recover from failures (e.g., server crashes, database outages, cloud provider failures) within a maximum of 30 minutes of the fault being detected.
**NFR3.03** Data Recovery A daily automated backup system must be in place, with the ability to recover all data within 4 hours of a request.
**NFR3.04** Fault Tolerance The system must tolerate the failure of a component (e.g., a TikTok API failure) without a complete platform downtime; an appropriate message must be displayed to the user, and the system must retry later.
**NFR3.05** Handling Temporary Interruptions The system must support an automatic retry mechanism for failed calls (e.g., view fetching, payment processing) with exponential backoff.
**NFR3.06** Performance Monitoring A continuous monitoring and alerting system must be in place to monitor: (a) server response time, (b) database status, (c) external API usage, and (d) the number of active users, sending immediate alerts to the operations team if any indicator exceeds the specified limits.

## 3.4 Security Requirements
**NFR4.01** Encryption of Sensitive Data All sensitive data must be encrypted in transit using at least TLS 1.3 and at rest using AES-256 encryption.
**NFR4.02** Password Protection ,Passwords must be stored using strong hash algorithms such as bcrypt or Argon2.
**NFR4.03** Two-Factor Authentication (2FA) , Two-factor authentication should be optionally enabled for all users and mandatory for brands managing large budgets (over $10,000).
**NFR4.04** API Protection , All APIs must be protected using: (a) JWT authentication with a limited validity period (1 hour), (b) authorization to control access based on user type and role, and (c) request limiting to prevent DDoS attacks.
**NFR4.05** Payment Security , All payments must comply with PCI-DSS standards (or equivalent in Arab markets), and no credit card data should be stored on the platform's servers (use external payment gateways such as Stripe, PayPal, and Mada).
**NFR4.06** Personal Data Protection , Compliance with personal data protection laws (GDPR for European markets, PDPL for Saudi Arabia, and other local laws) is required by: (a) obtaining explicit user consent for data collection and use, (b) providing the option to delete the account and all its data, and (c) not sharing data with third parties without consent.
**NFR4.07** Preventing Injection Attacks Prepared statements or ORM must be used to prevent SQL injection attacks, and input validation must be performed to prevent XSS and CSRF attacks.
**NFR4.08** Audit Logging , All security events (e.g., failed login attempts, password changes, payment transactions, changes in user permissions) must be logged in a protected audit log for future reference.
**NFR4.09** Protecting Content from Theft , Measures must be implemented to protect source content from unauthorized downloading, such as: (a) watermarking videos, (b) restricting downloads to registered users only, and (c) using signed URLs for media files.
**NFR4.10** Creator Account Security , Creator accounts must be protected from account theft or impersonation by verifying email and phone numbers upon registration and sending notifications when logging in from a new device.

## 3.5 Usability Requirements
**NFR5.01** Intuitive User Interface , The user interface should be simple and intuitive, enabling a new (non-technical) user to complete registration, create a campaign, or apply for a campaign in under 5 minutes without needing a user manual.
**NFR5.02 ** Full Arabic Language Support | The interface should fully support Arabic with: (a) correct RTL direction, (b) Arabic standard formatting for dates and numbers, and (c) font compatibility with Arabic text.
**NFR5.03**  English Language Support | The interface should also be available in English, with easy switching between languages ​​(a clear toggle button on all pages).
**NFR5.04**Responsive Design | All platform pages should be responsive across different screen sizes: (a) desktop, (b) tablet, and (c) smartphone, with the experience optimized for each screen size.
**NFR5.05** In-App Instructions and Guidelines | The app must include built-in tooltips and onboarding tutorials for new users, explaining how to: (a) create a campaign for advertisers, and (b) apply for a campaign for content creators.
**NFR5.06 ** Accessibility | The platform must comply with WCAG 2.1 accessibility standards at least level AA, including: (a) appropriate color contrast, (b) screen reader support, and (c) keyboard-only navigation.

**NFR5.07** Fast User Response Times | Users must receive immediate confirmation messages when an action is performed (e.g., "Campaign created successfully," "Video uploaded successfully") within 2 seconds of the action being performed.
**NFR5.08 ​​**Choice of Notification Style (a) (email, in-app), and (b) Notification Frequency (instant, daily, weekly).
## 3.6 Compatibility Requirements
**NFR6.01** Browser Compatibility | The platform must run on the latest versions of the following browsers: Google Chrome, Mozilla Firefox, Safari, and Microsoft Edge.
**NFR6.02** External API Compatibility | The platform must be compatible with current and future APIs for social media platforms (TikTok, Instagram, YouTube), with a backup plan in case these APIs change**.**
**NFR6.03** Local and Global Payment Method Compatibility | The platform must support local (Mada, STC Pay, local bank transfer) and global (PayPal, Stripe, credit cards) payment methods with seamless integration with each.

## 3.7 Maintainability Requirements
**NFR7.01** Code Documentation: The source code must be clearly documented (in-code documentation, function and class descriptions) to facilitate understanding and development by new developers.
**NFR7.02** Use of Design Patterns: Well-established design patterns (e.g., MVC, Repository, Service Layer) must be used to facilitate maintenance and segregation of responsibilities.

**NFR7.03** Zero-Downtime Updates: The infrastructure must allow for the application of updates and patches without requiring a complete platform downtime (zero-downtime deployment).
**NFR7.04** Administrator Control Panel: A comprehensive control panel must be provided to the administration team, enabling: (a) monitoring of system performance, (b) viewing reports and analytics, (c) managing users and content, and (d) resolving conflicts and issues.
**NFR7.05** Error Logging: All errors and exceptions must be logged in a central log with sufficient detail (error time, error type, request path, user data) to facilitate debugging.
**NFR7.06** Automated Testing: Automated testing must cover at least: (a) 80% of the code (Unit Tests), (b) all major use cases (Integration Tests), and (c) critical scenarios (End-to-End Tests).
**NFR7.07** Version Management: A version management system (Git) with a clear development process (such as GitFlow) must be used to track changes and facilitate team collaboration.

## 3.8 Legal & Compliance Requirements
**NFR8.01** Data Protection Compliance The platform must comply with data protection laws in all target markets: (GDPR for the EU, PDPL for Saudi Arabia, and privacy laws in the Gulf Cooperation Council (GCC) countries and Egypt), providing: (a) a clear privacy policy, (b) a mechanism for data deletion upon request, and (c) a record of user consent to data collection.
**NFR8.02** Advertising and Content Compliance The platform must comply with advertising laws in each country, specifically: (a) not advertising prohibited products (gambling, alcohol, tobacco), (b) not misleading consumers, and (c) adhering to halal content standards as advertised.
**NFR8.03** Secure Payment Compliance All payments must comply with PCI-DSS standards (for credit card processing) and local security standards (such as the Saudi Central Bank's standards for electronic payments). NFR8.04 Copyright and Intellectual Property Policy: The platform must include a clear copyright and intellectual property policy, with a mechanism for reporting copyright infringement and removing infringing content within 48 hours.

**NFR8.05** Terms of Service: The Terms of Service must be accessible and clearly legible, and must include: (a) user responsibilities, (b) cancellation and refund policy, (c) dispute resolution policy, and (d) the platform's legal liability.
**NFR8.06** Disclosure of Business Relationships: The platform must clearly disclose: (a) its commission rate, (b) any financial relationships with third parties (such as payment providers and analytics companies), and (c) its paid advertising policy, if applicable.
**NFR 8.07** Halal Content Standard (Sharia Supervision): There must be a written and documented standard for "Halal Content" that includes: (a) a list of prohibited content (gambling, alcohol, sexual content, explicit music, dubious currencies, unrealistic profit claims), (b) a review and audit mechanism, and (c) a Sharia Advisory Committee (if applicable) for periodic review.
**NFR 8.08** Data Retention: Financial records and audit decisions must be retained for a minimum of 5 years (or as required by law in each country), with the ability to export them upon request from regulatory authorities.

## 3.9 Documentation Requirements
**NFR 9.01** User Documentation: User documentation must be provided in both Arabic and English, including: (a) a Quick Start Guide, (b) an Advertiser User Guide, (c) a Content Creator User Guide, and (d) Frequently Asked Questions (FAQs).
**NFR9.02** Developer Documentation: Technical documentation must be provided to developers, including: (a) API documentation, (b) deployment guide, (c) database schema guide, and (d) a developer contribution guide.
**NFR9.03** Operational Documentation: Documentation must be provided to the operations team, including: (a) a monitoring and notifications guide, (b) a disaster recovery guide, (c) a routine maintenance guide, and (d) a user and content management guide.
**NFR9.04** Compliance Documentation: All compliance policies (privacy, security, halal content, secure payment) must be documented and updated periodically (at least annually).

## 3.10 Portability Requirements
**NFR10.01** System Transfer Between Cloud Providers: The infrastructure must be transferable between cloud providers (AWS, Google Cloud, Azure, or on-premises servers) without significant code changes, using containers (such as Docker) and an orchestration (such as Kubernetes).
**NFR10.02** Data Transfer: It must be possible to export all user data (campaigns, segments, transactions) in standard formats (JSON, CSV) for transfer to another system if required.
**NFR10.03** Multi-Environment Support: The system must support operation in multiple environments (development, testing, production) with different configurations for each environment (separate databases, different API keys)
