# Friends Hub Design

## Goal

Create a single new `Friends` hub inside the main site, entered from the main navigation like `Bili Hub` and `AI 流量`, while removing friend-link entry points and dedicated friend-link content from `blog` and `build`.

## Product Scope

### Main Site

- Add a new top-level navigation entry in the main site navbar:
  - Label: `Friends`
  - Routing style: same level as `/bili` and `/ai-traffic`
- Add a new dedicated route:
  - `/friends`
- The new `/friends` page becomes the only active friend-link center across the project.

### Page Content

The new `/friends` page contains exactly three functional sections in this first version:

1. `本站信息`
2. `申请友链说明`
3. `申请友链留言区`

This first version does **not** include any existing or migrated friend cards / partner list.

### Blog

- Remove the friend-link menu entry from the Hexo blog navigation.
- Stop using the blog `link` page as a friend-link destination.
- Do not preserve a migration notice page in the blog for this iteration.

### Build

- Remove the `links` entry from the `build` navigation.
- Remove the `LinksPage` route from the `build` app.
- Do not preserve the old `links` page as an active destination.

## Information Architecture

### Main Navigation

- `Friends` appears in the main site navbar beside the existing main-site product pages.
- The route follows the main site shell and existing routing conventions used by `Bili Hub`, `AI 流量`, `Gallery`, and `Guestbook`.

### Friends Page Structure

#### 1. Hero / Title Area

Purpose:
- Introduce the page as a dedicated signal station for exchanging friend links.
- Make the page feel like a standalone destination rather than a generic form page.

Contents:
- Small eyebrow label
- Main title
- Short supporting paragraph

Recommended content direction:
- Eyebrow: signal / network / channel themed
- Title: friend-link themed but more polished than simply `友情链接`
- Supporting copy: explain that this is the unified place to view site info and submit applications

#### 2. Site Information Card

Purpose:
- Provide the canonical information other site owners need for adding this site.

Contents:
- Site name
- Site URL
- Short description
- Avatar / logo image

Optional enhancement:
- Copy-friendly formatting block for fast manual reuse

#### 3. Friend-Link Application Guide Card

Purpose:
- Tell users how to apply and what format to use.

Contents:
- Short application rules
- Required fields
- A copyable template

Suggested required fields:
- Site name
- Site URL
- Short description
- Avatar image URL

Suggested messaging:
- Add this site first, then leave a message in the application area below
- Keep the description short and clear
- Use a stable avatar image URL

#### 4. Application Message Area

Purpose:
- Provide a real interactive application channel, directly on the page

Behavior:
- Reuse the existing main-site guestbook / message submission capability
- The UI wording should be adapted for friend-link application use
- The section should visually feel embedded into the Friends page, not pasted from the guestbook page

Non-goal:
- No new backend schema
- No separate moderation system in this iteration

## Visual Direction

### Design Theme

Page identity:
- `静谧通信站`
- A calm network/signal exchange atmosphere
- Distinct from the candy palette of `Bili Hub`
- Distinct from the creamy dashboard feel of `AI 流量`

### Color System

Primary palette:
- Background: `#F8F5EE`
- Deep ink green: `#102A24`
- Mist teal: `#6FAE9B`
- Amber gold: `#E6B85C`
- Main text: `#1A1D1A`

Usage:
- Background and large surfaces use warm off-white
- Titles and strong UI anchors use deep green
- Secondary accents use mist teal
- Highlights, badges, and action emphasis use amber gold

### Surface Style

- Soft gradients in the page background
- Blurred light blobs or atmospheric halos
- Frosted or semi-translucent cards
- Refined border treatment instead of heavy shadows

### Motion

Keep motion restrained:
- Light entrance reveals
- Gentle hover glow / elevation
- Smooth button transitions

Avoid:
- Heavy parallax
- Over-animated decorative systems
- Motion that competes with text readability

### Responsive Intent

Desktop:
- Cards can sit in a composed editorial grid

Mobile:
- Stack vertically with comfortable spacing
- Preserve headline clarity and touch target size

## Interaction Design

### Navigation

- Clicking `Friends` opens `/friends`
- The page stays within the main-site experience and layout conventions

### Friend-Link Submission

- Users read site info and application rules first
- Users then scroll to the message area and submit their application there
- The message area copy should explicitly frame the input as a friend-link application

### Copy Clarity

The new page should clearly communicate:
- This is now the canonical friend-link page
- Site information is provided here
- Applications are left here

## Content Strategy

### Keep

- `本站信息`
- `申请说明`
- `留言区`

### Remove

- Existing friend-link card list from the first version
- Old friend-link entry points in `blog`
- Old friend-link entry points in `build`

### Do Not Add Yet

- Friend categories
- Approval states
- Auto-generated link cards
- Search / filter
- Dedicated backend workflow

## Technical Plan Shape

### Main

Expected change areas:
- Main navbar definition
- Main routing
- New `Friends` page component
- New styling for the page
- Reuse of the existing message / guestbook capability

### Build

Expected change areas:
- Navigation definition
- App route definition
- Existing `LinksPage` removal from active app flow

### Blog

Expected change areas:
- Butterfly menu configuration
- Link page source content / active usage

## Testing Expectations

### Main Site

- `Friends` appears in the navbar
- Clicking it routes to `/friends`
- The new page renders correctly on desktop and mobile
- The message area works with the reused existing submission path

### Build

- No `links` entry remains in navigation
- No active `LinksPage` route remains in user-facing flow

### Blog

- No `Link` menu entry remains in navigation
- The blog no longer acts as a friend-link destination

## Non-Goals

- No preservation banner or redirect page inside `blog`
- No preservation banner or redirect page inside `build`
- No old-friends card migration in the first iteration
- No backend redesign
- No moderation dashboard
