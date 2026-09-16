# Angular integration

How to move the frontend from nine static JSON files to one API call, **without changing any
component**.

The API response was shaped deliberately to match the existing models
(`src/app/core/models/*.model.ts`) field for field — verified by comparing the live API
output against the original JSON: every field of every record matched, including ordering,
nulls and the level-0 skills. So the migration touches exactly one file:
`ConfigDataService`.

---

## 1. Add the API base URL to the environment

The Angular project has no `src/environments/` today; it uses `angular.json` build
configurations. Add environment files and wire them with `fileReplacements`.

**`src/environments/environment.ts`** (development):

```ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
};
```

**`src/environments/environment.prod.ts`**:

```ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://<your-backend-domain>/api/v1',
};
```

Then in `angular.json`, under both the `production` and `github-pages` configurations:

```jsonc
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

> The `github-pages` configuration composes with `production` (`--configuration=production,github-pages`),
> so adding it to `production` alone is enough — but declaring it in both is harmless and
> more obvious to a reader.

Never hardcode the URL in a component. Only `ConfigDataService` should know it exists.

---

## 2. Add the API service

**`src/app/core/services/profile-api.service.ts`**:

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Profile, Contact, Experience, Project, Achievement,
  Course, TimelineEvent, ManagementResponsibility, SkillData,
} from '../models';

/**
 * The complete public profile, as returned by GET /api/v1/public/profile.
 *
 * Each member reuses the existing frontend model, because the API was built to match them.
 */
export interface PublicProfileResponse {
  person: Profile;
  contact: Contact | null;
  experiences: Experience[];
  projects: Project[];
  achievements: Achievement[];
  courses: Course[];
  timelineEvents: TimelineEvent[];
  managementRoles: ManagementResponsibility[];
  skills: SkillData;
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Fetches the entire profile in one request, replacing the nine separate JSON files.
   *
   * The browser handles caching on its own: the response carries an ETag and
   * Cache-Control, so a repeat load costs a 304 with an empty body.
   */
  getPublicProfile(): Observable<PublicProfileResponse> {
    return this.http.get<PublicProfileResponse>(`${this.baseUrl}/public/profile`);
  }
}
```

---

## 3. Rewire `ConfigDataService`

Keep the public surface identical — the same nine signals, the same `loadX()` methods, the
same error signals — so no component changes. Only the data source changes: one request
fans out into the nine signals.

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ProfileApiService } from './profile-api.service';
import { /* ...models... */ } from '../models';

@Injectable({ providedIn: 'root' })
export class ConfigDataService {
  private readonly api = inject(ProfileApiService);

  private readonly profileSignal = signal<Profile | null>(null);
  private readonly experienceSignal = signal<ExperienceData | null>(null);
  // ...one per section, exactly as today...

  readonly profile = this.profileSignal.asReadonly();
  readonly experience = this.experienceSignal.asReadonly();
  // ...

  private loaded = false;
  private pending = false;
  private readonly errorSignal = signal(false);
  private readonly loadingSignal = signal(false);

  readonly isLoading = computed(() => this.loadingSignal());
  readonly profileError = computed(() => this.errorSignal());
  // ...the per-section error signals now all reflect the single request...

  /**
   * One request populates every signal. The existing loadProfile()/loadSkills()/... methods
   * all delegate here, so components keep calling exactly what they call today.
   */
  private loadAll(force = false): void {
    if (this.pending || (this.loaded && !force)) return;

    this.pending = true;
    this.loadingSignal.set(true);
    this.errorSignal.set(false);

    this.api
      .getPublicProfile()
      .pipe(
        tap((data) => {
          this.profileSignal.set(data.person);
          this.contactSignal.set(data.contact);
          this.experienceSignal.set({ experiences: data.experiences });
          this.projectsSignal.set({ projects: data.projects });
          this.achievementsSignal.set({ achievements: data.achievements });
          this.coursesSignal.set({ courses: data.courses });
          this.timelineSignal.set({ events: data.timelineEvents });
          this.managementSignal.set({ responsibilities: data.managementRoles });
          this.skillsSignal.set(data.skills);
          this.loaded = true;
        }),
        catchError((error) => {
          console.error('Error loading profile:', error);
          this.errorSignal.set(true);
          return of(null);
        }),
        finalize(() => {
          this.pending = false;
          this.loadingSignal.set(false);
        }),
      )
      .subscribe();
  }

  loadProfile(force = false): void { this.loadAll(force); }
  loadExperience(force = false): void { this.loadAll(force); }
  loadProjects(force = false): void { this.loadAll(force); }
  loadAchievements(force = false): void { this.loadAll(force); }
  loadCourses(force = false): void { this.loadAll(force); }
  loadManagement(force = false): void { this.loadAll(force); }
  loadSkills(force = false): void { this.loadAll(force); }
  loadTimeline(force = false): void { this.loadAll(force); }
  loadContact(force = false): void { this.loadAll(force); }
  loadAllData(force = false): void { this.loadAll(force); }
}
```

Note the wrapper shapes: the API returns `experiences` as a bare array, while the frontend's
`ExperienceData` is `{ experiences: [...] }`. Wrapping happens here, in one place.
`skills` needs no wrapping — the API already returns `{ categories: [...] }`, matching
`SkillData`.

---

## 4. What does *not* change

- Every component keeps its current `ngOnInit` calls and its current template bindings.
- `experience.responsibilities`, `project.highlights`, `project.technologies` and
  `course.skills` all still arrive as `string[]`, so `@for (r of exp.responsibilities; track r)`
  keeps working.
- `id` values are unchanged (`exp1`, `proj14`, `evt3`, …), so `track exp.id` and the
  `/projects#project-proj1` deep links from the profile page still resolve.
- `avatar` and `companyLogo` still contain frontend-relative paths
  (`/assets/images/...`), so `Location.prepareExternalUrl` handling stays as-is.
- Skill `level: 0` is preserved, so the grey "no-rank" tag still renders.

---

## 5. Two behaviour changes worth knowing

1. **`management.level`.** The API returns the true stored value, which for `mgmt3` is
   `"medium"`. The current `ManagementComponent` filters for `'high'` and `'low'`, so that
   record renders nowhere — a pre-existing bug the migration makes visible rather than
   causes. Fix by widening the filter (see `docs/MIGRATION-MAPPING.md` §5.4).

2. **Extra project fields.** `project.type`, `project.company` and `project.isCurrent` are in
   the data and now in the API, but absent from the `Project` interface. Add them to the
   interface to use them, or ignore them — extra properties break nothing.

---

## 6. CORS

The backend allows origins from `CORS_ORIGINS`. For GitHub Pages, include the **origin
only** — no path:

```
CORS_ORIGINS=http://localhost:4100,https://aelbazz.github.io
```

`https://aelbazz.github.io/profile/` is served from the origin `https://aelbazz.github.io`;
including the `/profile/` path would never match and the browser would block every request.

---

## 7. Rollback

Keep `public/assets/data/*.json` in the frontend repo until the API has been live for a
while. Reverting is then a one-file change: restore the old `ConfigDataService`. The backend
repo's `prisma/data/` holds the same snapshot, so the two cannot drift apart silently —
re-sync with `./scripts/sync-frontend-data.sh`.
