# Migration Mapping — Angular static data → Prisma → NestJS DTO → API → Angular

This document is the **mandatory first deliverable**. It records what the existing Angular
project actually contains, field by field, and how each field maps into the backend.

Source of truth inspected:

| Source | Path (in `myProfile` repo) |
| --- | --- |
| TypeScript interfaces | `src/app/core/models/*.model.ts` |
| Static data | `public/assets/data/*.json` |
| Consuming components | `src/app/features/*/*.component.{ts,html}` |
| Data access | `src/app/core/services/config-data.service.ts` |

**Nothing below is invented.** Every field, type, nullability figure and enum value was
extracted from the nine JSON files and cross-checked against the interfaces. Where the
interfaces and the data disagree, the discrepancy is called out explicitly — per the spec,
*the actual existing schema/code takes precedence.*

---

## 0. Executive summary of conflicts

Eight findings materially affect the schema. Details in §5.

| # | Finding | Resolution |
| --- | --- | --- |
| C1 | **No ordering fields exist anywhere.** The UI depends entirely on JSON array position. | Add `sortOrder Int` — the smallest addition that preserves current behaviour. |
| C2 | **No visibility/published fields exist anywhere.** | Add `isPublished Boolean @default(true)` on person-owned root entities only. |
| C3 | **Skills are a whole domain the conceptual model omits** (117 skills, 14 categories, its own page). | Add `skill_category` + `skill`. Without them the Skills page cannot leave static data. |
| C4 | `mgmt_role.level` data contains `"medium"`, but the interface declares `'high' \| 'low'`, and the component only renders `high` and `low`. **One record is currently invisible in the UI.** | Store as enum `high \| medium \| low`. Frontend bug noted separately. |
| C5 | `experience.achievements` and `mgmt_role.{keyResponsibilities,achievements}` are string arrays, same as responsibilities. | Model as child tables, consistent with `exp_responsibility`. |
| C6 | `contact.socialLinks` is a nested array the conceptual model does not name. | Child table `contact_social_link`. |
| C7 | Several interface fields exist in **no** data record; several data fields exist in **no** interface. | Keep both sides; nullable. Listed in §5.7. |
| C8 | `project.type` and `course.level` look enum-ish but are free text (7 and 5 distinct values, mixing unrelated axes). | Keep as `String`. Do **not** enum. |

---

## 1. Entity inventory

Record counts are actual, from the JSON files.

| Domain entity | Prisma model | Source file | Rows | Cardinality to `person` |
| --- | --- | --- | ---: | --- |
| person | `Person` | `profile.json` | 1 | — (singleton) |
| contact | `Contact` | `contact.json` | 1 | 1 : 1 |
| — social links | `ContactSocialLink` | `contact.json.socialLinks` | 4 | via contact |
| experience | `Experience` | `experience.json` | 9 | 1 : N |
| — responsibilities | `ExperienceResponsibility` | `.responsibilities[]` | 51 | via experience |
| — achievements | `ExperienceAchievement` | `.achievements[]` | 27 | via experience |
| — technologies | `ExperienceTechnology` | `.technologies[]` | 61 | junction |
| project | `Project` | `projects.json` | 16 | 1 : N |
| — highlights | `ProjectHighlight` | `.highlights[]` | 64 | via project |
| — technologies | `ProjectTechnology` | `.technologies[]` | 69 | junction |
| technology | `Technology` | derived (see §3) | 57 | reusable, global |
| achievement | `Achievement` | `achievements.json` | 10 | 1 : N |
| course | `Course` | `courses.json` | 27 | 1 : N |
| — skills | `CourseSkill` | `.skills[]` | 147 | via course |
| timeline_event | `TimelineEvent` | `timeline.json` | 18 | 1 : N |
| mgmt_role | `ManagementRole` | `management.json` | 3 | 1 : N |
| — responsibilities | `ManagementResponsibilityItem` | `.keyResponsibilities[]` | 17 | via role |
| — achievements | `ManagementAchievement` | `.achievements[]` | 12 | via role |
¹ Superseded by `User` (with `role: CLIENT`) when the backend became a multi-tenant
platform - see `docs/SAAS-ARCHITECTURE.md`. This table describes the schema as designed
for the original single-profile migration; it is preserved as-is for that history.

| skill category | `SkillCategory` | `skills.json.categories` | 14 | 1 : N *(addition, C3)* |
| skill | `Skill` | `.categories[].skills[]` | 117 | via category *(addition, C3)* |
| admin user | `AdminUser`¹ | — | 1 | auth only, never public |

---

## 2. Field-by-field mapping

Legend: **R** required in data · **O** optional/absent in some records · `n/m` = present in n of m rows.

### 2.1 person ← `profile.json`

| Angular (`Profile`) | Type | Presence | Prisma field | Prisma type | API (`PersonDto`) |
| --- | --- | --- | --- | --- | --- |
| `name` | string | R | `name` | `String` | `name` |
| `title` | string | R | `title` | `String` | `title` |
| `summary` | string | R | `summary` | `String @db.Text` | `summary` |
| `location` | string | R | `location` | `String` | `location` |
| `yearsOfExperience` | number | R | `yearsOfExperience` | `Int` | `yearsOfExperience` |
| `avatar` | string | R | `avatar` | `String` | `avatar` |
| `tagline` | string | R | `tagline` | `String` | `tagline` |
| `linkedin` | string? | R (1/1) | `linkedin` | `String?` | `linkedin` |
| `birthday` | string? | R (1/1) | `birthday` | `String?` | `birthday` |
| — | — | — | `id` | `String @id @default(cuid())` | `id` |
| — | — | — | `slug` | `String @unique` | *(not exposed)* |

`Profile` has **no `id`** in the frontend. A `slug` (seeded `"default"`) makes the singleton
addressable and leaves room for multiple profiles later without over-engineering now.

`avatar` is stored exactly as-is (`/assets/images/profile-image.jpg`) — a frontend-relative
path. The API does not rewrite it; the frontend already resolves it via
`Location.prepareExternalUrl`. Changing this would break the existing `avatarUrl()` computed.

### 2.2 contact ← `contact.json`

| Angular (`Contact`) | Type | Presence | Prisma | Notes |
| --- | --- | --- | --- | --- |
| `email` | string | R | `email String` | |
| `phone` | string | R | `phone String` | |
| `whatsapp` | string | R | `whatsapp String` | identical to `phone` in current data |
| `linkedin` | string | R | `linkedin String` | duplicated on `person` too |
| `location` | string? | R (1/1) | `location String?` | duplicated on `person` too |
| `birthday` | string? | R (1/1) | `birthday String?` | duplicated on `person` too |
| `muchskills` | string? | R (1/1) | `muchskills String?` | |
| `socialLinks` | `SocialLink[]` | R, 4 items | → `ContactSocialLink[]` | §2.3 |

> `location`, `birthday` and `linkedin` are genuinely duplicated between `profile.json` and
> `contact.json` today, with identical values. Both are preserved so neither consumer breaks.
> De-duplicating is a frontend decision, not a migration one.

### 2.3 contact_social_link ← `contact.json.socialLinks[]`

| Angular (`SocialLink`) | Presence | Prisma |
| --- | --- | --- |
| `platform` | R (4/4) | `platform String` |
| `url` | R (4/4) | `url String` |
| `icon` | R (4/4) | `icon String?` |
| *array index* | — | `sortOrder Int` **(C1)** |

Values present: LinkedIn, MuchSkills, Medium, GitHub.

### 2.4 experience ← `experience.json`

| Angular (`Experience`) | Type | Presence | Prisma | Notes |
| --- | --- | --- | --- | --- |
| `id` | string | R | `legacyId String @unique` | `"exp1".."exp9"` — preserved, see §4 |
| `company` | string | R | `company String` | |
| `companyFullName` | string? | 9/9 | `companyFullName String?` | |
| `companyLogo` | string? | 9/9 | `companyLogo String?` | frontend-relative path |
| `companyWebsite` | string? | 9/9 | `companyWebsite String?` | |
| `companyDescription` | string? | 9/9 | `companyDescription String? @db.Text` | |
| `position` | string | R | `position String` | |
| `location` | string | R | `location String` | |
| `startDate` | string | R | `startDate String` | **free text** — see §4 |
| `endDate` | string \| null | 8/9 non-null | `endDate String?` | |
| `isCurrent` | boolean | R | `isCurrent Boolean` | |
| `description` | string | R | `description String @db.Text` | |
| `responsibilities` | string[] | R, 51 total | → `ExperienceResponsibility[]` | **C5** |
| `technologies` | string[] | R, 61 total | → `ExperienceTechnology[]` | junction |
| `achievements` | string[] | R, 27 total | → `ExperienceAchievement[]` | **C5** |
| *array index* | — | `sortOrder Int` | **C1** |
| — | — | `isPublished Boolean @default(true)` | **C2** |

### 2.5 project ← `projects.json`

| Angular (`Project`) | Type | Presence | Prisma | Notes |
| --- | --- | --- | --- | --- |
| `id` | string | R | `legacyId String @unique` | `"proj1".."proj16"` |
| `name` | string | R | `name String` | |
| `description` | string | R | `description String @db.Text` | |
| `role` | string | R | `role String` | |
| `startDate` | string | R | `startDate String` | free text (years) |
| `endDate` | string \| null | 10/16 non-null | `endDate String?` | |
| `technologies` | string[] | R, 69 total | → `ProjectTechnology[]` | junction |
| `highlights` | string[] | R, 64 total | → `ProjectHighlight[]` | |
| `imageUrl` | string? | **0/16** | `imageUrl String?` | **C7** — in interface, never in data |
| `githubUrl` | string? | **0/16** | `githubUrl String?` | **C7** — template renders it conditionally |
| `liveUrl` | string? | **0/16** | `liveUrl String?` | **C7** — same |
| `isStrategicInitiative` | boolean? | 4/16 | `isStrategicInitiative Boolean @default(false)` | |
| — | — | 6/16 | `isCurrent Boolean @default(false)` | **C7** — in data, *not* in interface |
| — | — | 16/16 | `type String?` | **C7** — in data, *not* in interface |
| — | — | 16/16 | `company String?` | **C7** — in data, *not* in interface |
| *array index* | — | `sortOrder Int` | **C1** |
| — | — | `isPublished Boolean @default(true)` | **C2** |

### 2.6 achievement ← `achievements.json`

| Angular (`Achievement`) | Presence | Prisma |
| --- | --- | --- |
| `id` | R | `legacyId String @unique` (`"ach1".."ach10"`) |
| `title` | R | `title String` |
| `description` | R | `description String @db.Text` |
| `date` | R | `date String` (free text: `"2025"`, `"Feb 2025"`) |
| `category` | R | `category AchievementCategory` (enum) |
| `organization` | 10/10 | `organization String?` |
| `icon` | 10/10 | `icon String?` |
| `articleUrl` | **1/10** | `articleUrl String?` |

`category` — interface declares four values; data uses three:

| Value | In interface | Rows |
| --- | --- | ---: |
| `award` | yes | 3 |
| `certification` | yes | 1 |
| `recognition` | yes | 6 |
| `milestone` | yes | **0** |

Enum keeps all four so the admin portal can use `milestone` without a migration.

### 2.7 course ← `courses.json`

| Angular (`Course`) | Presence | Prisma | Notes |
| --- | --- | --- | --- |
| `id` | R | `legacyId String @unique` | `"edu1".."edu27"` |
| `title` | R | `title String` | |
| `provider` | R | `provider String` | |
| `completionDate` | R | `completionDate String` | free text |
| `level` | 27/27 | `level String?` | **C8** — free text, not enum |
| `description` | 27/27 | `description String? @db.Text` | |
| `skills` | R, 147 total | → `CourseSkill[]` | |
| `duration` | 5/27 | `duration String?` | `"9 Months"`, `"35m"`, `"2h 8m"` — mixed units |
| `instructor` | 8/27 | `instructor String?` | |
| `courseUrl` | 7/27 | `courseUrl String?` | |
| `certificateUrl` | **0/27** | `certificateUrl String?` | **C7** — interface only |
| — | 3/27 | `startDate String?` | **C7** — data only, not in interface |
| — | 2/27 | `grade String?` | **C7** — data only, not in interface |

`level` mixes two unrelated axes — degree level (`Diploma`, `Bachelor's Degree`,
`Professional Certification`) and difficulty (`Beginner` ×17, `Intermediate` ×7). Modelling
it as an enum would force a false taxonomy, so it stays `String?`.

### 2.8 timeline_event ← `timeline.json`

| Angular (`TimelineEvent`) | Presence | Prisma |
| --- | --- | --- |
| `id` | R | `legacyId String @unique` (`"evt1".."evt18"`) |
| `date` | R | `date String` (free text) |
| `title` | R | `title String` |
| `subtitle` | R | `subtitle String?` |
| `description` | R | `description String @db.Text` |
| `type` | R | `type TimelineEventType` (enum) |
| `icon` | 18/18 | `icon String?` |

`type` — interface declares five values; data uses three: `work` ×7, `achievement` ×6,
`education` ×5. `project` and `certification` are declared but unused. Enum keeps all five.

### 2.9 mgmt_role ← `management.json`

| Angular (`ManagementResponsibility`) | Presence | Prisma | Notes |
| --- | --- | --- | --- |
| `id` | R | `legacyId String @unique` | `"mgmt1".."mgmt3"` |
| `level` | R | `level ManagementLevel` | **C4** |
| `title` | R | `title String` | |
| `organization` | R | `organization String` | |
| `startDate` | R | `startDate String` | |
| `endDate` | 1/3 non-null | `endDate String?` | |
| `isCurrent` | R | `isCurrent Boolean` | |
| `description` | R | `description String @db.Text` | |
| `teamSize` | **0/3** | `teamSize Int?` | **C7** — interface only |
| `keyResponsibilities` | R, 17 total | → `ManagementResponsibilityItem[]` | **C5** |
| `achievements` | R, 12 total | → `ManagementAchievement[]` | **C5** |

### 2.10 skill_category / skill ← `skills.json` *(addition — C3)*

| Angular (`Skill`) | Presence | Prisma |
| --- | --- | --- |
| `name` | 117/117 | `name String` |
| `level` | 117/117 | `level Int` (0–9) |
| `category` | 117/117 | → `SkillCategory.name` (denormalised on the child in JSON) |
| `since` | **117/117** | `since Int?` |
| `icon` | **0/117** | `icon String?` — resolved at runtime by `SkillIconService` |
| `proficiency` | 0/117 | *not persisted* — derived from `level` in the UI |
| `yearsOfExperience` | 0/117 | `yearsOfExperience Int?` |
| `endorsements` | 0/117 | `endorsements Int?` |

Level distribution: `0` ×40, `3` ×16, `6` ×23, `7` ×1, `9` ×37. Level `0` means *unranked*
and the UI renders it as a grey `no-rank` tag — it is **not** the same as level 1. The seed
preserves `0` verbatim; the API must not coerce it.

---

## 3. Technology extraction (reuse, no duplication)

`technology` has no dedicated source file. Technology names live inline as string arrays on
experiences and projects. The seed therefore **derives** the table:

```
experience[].technologies (61 refs)  ┐
                                     ├─► distinct, trimmed  ──►  technology (57 rows)
project[].technologies    (69 refs)  ┘
```

Measured: 30 distinct on experiences, 31 distinct on projects, **4 overlapping**
(`Angular`, `NestJS`, `SASS`, `TypeScript`), union **57**. The seed upserts on a normalised
unique key so those four produce **one** row each and are referenced from both sides —
satisfying "do not duplicate technology records".

Matching is on `slug` (lower-cased, punctuation-collapsed) with `name` preserving the
original casing of first occurrence, so `Node.js` / `NodeJS` cannot split into two rows.

### `course.skills` is deliberately *not* joined to `technology`

147 references, 114 distinct values — but they are course topics (`"Instructional Design"`,
`"Teaching Methodologies"`), not technologies, and only a minority overlap the technology
set. Folding them into `technology` would pollute it. They become `CourseSkill` rows
(ordered strings), exactly mirroring the current `string[]`.

Likewise **`skill` and `technology` are kept separate.** Only 18 of the 57 technology names
also appear among the 117 skill names, and they carry different semantics (`skill.level` is a
self-assessed 0–9 proficiency; a technology is just a tag on an experience/project). Merging
them would force one of the two meanings onto the other.

---

## 4. Dates and legacy ids

**Dates stay `String`.** Every date in the source is human-formatted free text —
`"Jan 2024"`, `"2025"`, `"Feb 2025"`, `"June 26"` — at inconsistent precision (month+year,
year-only, month+day). Parsing to `DateTime` would:

1. invent a precision the data does not have (what day is `"2024"`?),
2. force the frontend to re-format on every render, changing displayed strings,
3. be lossy and irreversible.

Ordering is handled by `sortOrder` (C1), not by date parsing. If true date semantics are
wanted later, add nullable `startDateParsed DateTime?` columns alongside — additive, no
breakage.

**`legacyId`** preserves the original string ids (`exp1`, `proj14`, `evt3`, …). The frontend
already uses them: `track exp.id`, `[id]="'project-' + project.id"`, and the deep links
`/projects#project-proj1` from the profile page. Dropping them would break those anchors.
New primary keys are `cuid()`; `legacyId` is `@unique` and exposed as `id` in the public API
so existing templates keep working unchanged.

---

## 5. Conflicts in detail

### 5.1 C1 — No ordering fields (schema addition required)

No entity in any of the nine JSON files has an order/sequence/position field. The UI relies
entirely on array order, and `ConfigDataService` passes arrays through untouched.

A SQL table has no inherent row order, so without an explicit column the public API would
return rows in whatever order the planner chooses. **This is the one place the spec
authorises a schema addition**, so: `sortOrder Int` on every ordered collection —
`Experience`, `Project`, `Achievement`, `Course`, `TimelineEvent`, `ManagementRole`,
`SkillCategory`, `Skill`, and every child collection (responsibilities, highlights,
achievements, course skills, social links, and both technology junctions).

Seeded from the source array index (0-based), so first load reproduces today's order
byte-for-byte. Every public query carries `orderBy: { sortOrder: 'asc' }`.

> Note: the Skills page sorts by `level` descending at render time, and the Profile page
> sorts categories technical-first. Those are **presentation** sorts that stay in the
> frontend; `sortOrder` captures the underlying authored order.

### 5.2 C2 — No visibility/published fields (schema addition)

The spec says the public endpoint must "respect visibility/published state **if such fields
exist**". They do not exist. Since admin CRUD is a required deliverable, and editing a live
portfolio with no draft state means every keystroke is published, `isPublished Boolean
@default(true)` is added to person-owned root entities only. Defaulting to `true` means the
seed reproduces current behaviour exactly; the public endpoint filters on it.

### 5.3 C3 — Skills domain absent from the conceptual model

The conceptual entity list has no skill entity, but the frontend has `skills.json`
(19 KB, 117 skills in 14 categories), `SkillsComponent` with search and filtering, a skills
section on the profile page, `skill.model.ts`, and `SkillIconService`. Leaving it out would
mean the Skills page keeps reading static JSON — directly contradicting the stated goal of
making the backend the source of truth.

Per the precedence rule (*"If the existing frontend schema and the conceptual description
conflict, the actual existing schema/code takes precedence"*), `SkillCategory` and `Skill`
are included, with full CRUD and inclusion in the public payload.

### 5.4 C4 — `mgmt_role.level` mismatch, and a live frontend bug

- Interface declares `level: 'high' | 'low'`.
- Data contains `high` ×2 and **`medium`** ×1.
- `ManagementComponent` exposes `getHighLevelResponsibilities()` (`=== 'high'`) and
  `getLowLevelResponsibilities()` (`=== 'low'`).

`mgmt3` ("Team Leader — ITI eLearning Track") has `level: "medium"`, so it matches neither
filter and **renders nowhere**. The backend stores the true value via enum
`high | medium | low`. Fixing the component is a frontend change, tracked separately — the
migration must not silently rewrite the data to hide it.

### 5.5 C5 — Child string arrays

`experience.achievements` (27), `mgmt_role.keyResponsibilities` (17) and
`mgmt_role.achievements` (12) are string arrays exactly like `exp_responsibility`. The spec
forbids collapsing responsibilities into a single text field; the same reasoning applies to
these, so each gets an ordered child table.

### 5.6 C6 — `contact.socialLinks`

A 4-element nested array of `{platform, url, icon}`, not named in the conceptual model.
Modelled as `ContactSocialLink` with `sortOrder`.

### 5.7 C7 — Interface/data drift

**In the interface, absent from all data** (kept, nullable — the templates render them
conditionally, so they are intended future fields):

| Field | Rows with value |
| --- | ---: |
| `Project.imageUrl` / `.githubUrl` / `.liveUrl` | 0 / 16 |
| `Course.certificateUrl` | 0 / 27 |
| `ManagementResponsibility.teamSize` | 0 / 3 |
| `Skill.icon` / `.proficiency` / `.yearsOfExperience` / `.endorsements` | 0 / 117 |

**In the data, absent from the interface** (kept — dropping them would lose real content):

| Field | Rows with value | Note |
| --- | ---: | --- |
| `project.company` | 16 / 16 | all `"THIQAH"` |
| `project.type` | 16 / 16 | 7 distinct values |
| `project.isCurrent` | 6 / 16 | |
| `course.startDate` | 3 / 27 | |
| `course.grade` | 2 / 27 | |

### 5.8 C8 — Free text that looks enum-ish

`project.type` (7 distinct, e.g. `"Strategic Initiative → POC → MVP"`, `"Government
Platform"`) and `course.level` (5 distinct across two axes) stay `String`. Promoting them to
enums would lock in a taxonomy the data does not actually follow.

### 5.9 Icon values are stale

Every `icon` in the JSON is a Bootstrap Icons class (`bi-trophy-fill`, `bi-linkedin`), but
the app migrated to Font Awesome (see `FONTAWESOME_MIGRATION.md`); components map them at
runtime or ignore them. Values are migrated **verbatim** — normalising them is a frontend
concern and would be an invented change here.

---

## 6. Public API response shape

The payload mirrors the current frontend models so components need no restructuring.
Where the frontend expects `experience.responsibilities: string[]`, the API returns an
**array of strings**, not objects — child rows are flattened on the way out, ordered by
`sortOrder`. That keeps `@for (resp of exp.responsibilities; track resp)` working untouched.

```jsonc
{
  "person":     { "name": "...", "title": "...", "yearsOfExperience": 13, ... },
  "contact":    { "email": "...", "socialLinks": [ { "platform": "...", "url": "...", "icon": "..." } ] },
  "experiences":[ { "id": "exp1", ..., "responsibilities": ["..."], "technologies": ["..."], "achievements": ["..."] } ],
  "projects":   [ { "id": "proj1", ..., "highlights": ["..."], "technologies": ["..."] } ],
  "achievements":   [ { "id": "ach1", ... } ],
  "courses":        [ { "id": "edu1", ..., "skills": ["..."] } ],
  "timelineEvents": [ { "id": "evt1", ... } ],
  "managementRoles":[ { "id": "mgmt1", ..., "keyResponsibilities": ["..."], "achievements": ["..."] } ],
  "skills":     { "categories": [ { "category": "...", "skills": [ { "name": "...", "level": 9, "since": 2012 } ] } ] }
}
```

Note `skills` is returned as `{ categories: [...] }` — the exact shape of `SkillData`, so
`ConfigDataService.skills` keeps its current type.

The frontend's `ConfigDataService` currently issues nine separate JSON requests. After
migration it makes **one** call to `/api/v1/public/tenants/:slug/profile` and fans the response out into
the same nine signals — component code is unchanged.

---

## 7. Full mapping chain

```
profile.json          → Person                       → PersonDto              → person
contact.json          → Contact + ContactSocialLink  → ContactDto             → contact
experience.json       → Experience                   → ExperienceDto          → experiences[]
  .responsibilities[] → ExperienceResponsibility     → string[]               → experience.responsibilities
  .achievements[]     → ExperienceAchievement        → string[]               → experience.achievements
  .technologies[]     → ExperienceTechnology→Technology → string[]            → experience.technologies
projects.json         → Project                      → ProjectDto             → projects[]
  .highlights[]       → ProjectHighlight             → string[]               → project.highlights
  .technologies[]     → ProjectTechnology→Technology → string[]               → project.technologies
achievements.json     → Achievement                  → AchievementDto         → achievements[]
courses.json          → Course                       → CourseDto              → courses[]
  .skills[]           → CourseSkill                  → string[]               → course.skills
timeline.json         → TimelineEvent                → TimelineEventDto       → timelineEvents[]
management.json       → ManagementRole               → ManagementRoleDto      → managementRoles[]
  .keyResponsibilities[] → ManagementResponsibilityItem → string[]            → role.keyResponsibilities
  .achievements[]     → ManagementAchievement        → string[]               → role.achievements
skills.json           → SkillCategory + Skill        → SkillDataDto           → skills.categories[]
```

---

## 8. Not migrated

| Source | Why |
| --- | --- |
| `public/config/config.json` (`clarityProjectId`) | Frontend analytics bootstrap, loaded before the app renders. Not profile data. |
| `public/assets/files/*.pdf` | Binary CV, served as a static asset. |
| `public/assets/images/**` | Static assets; DB stores paths only. |
| `Skill.proficiency` | Derived from `level` in the UI; storing it would create two sources of truth. |
