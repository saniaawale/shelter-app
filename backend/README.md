# Local quiz matching

From the repository root, start the backend:

```powershell
& .\backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload
```

In a second terminal, from `frontend/`, run `npm run dev`. Open the Vite address,
complete the quiz, review your answers, and choose **View matches**. No login is
required. Vite forwards `/api/matches` to FastAPI's `/matches` route; the browser's
`/matches` page remains a frontend route, including on refresh.

## Configuration

Use `backend/.env.example` as a reference and add the required settings to
`backend/.env` without overwriting existing settings. `DATABASE_URL` is a Postgres
connection URI, not the Supabase HTTP project URL or a browser API key.
`MATCHING_AVAILABLE_STATUS` must equal the staff-maintained status that means
current availability has been confirmed. The example `available` value is not
automatically assigned to any records. Null statuses never qualify.

Keep database credentials in the backend. The repository uses encrypted, read-only
database connections and selects only fields required for matching.

For a separately hosted API, set `VITE_API_BASE_URL` in the frontend environment
to its public address, such as `http://localhost:8000`, and restart Vite.
Set backend `FRONTEND_ORIGIN` to the frontend's actual origin. The Vite proxy is
development-only; a production host needs an `/api` reverse proxy or an explicit
API base URL. Never put database credentials in a `VITE_` variable.

## How the request works

1. `AdopterQuiz.jsx` passes the reviewed answers into `App.jsx` when the visitor
   chooses View matches. App keeps them in memory so blocked browser storage does
   not prevent results or retaking the quiz. Session storage also supports reloads
   when available; blocked storage cannot preserve answers through a full reload.
2. `Matches.jsx` uses those answers, or saved answers on a direct visit. Incomplete
   answers prompt the visitor to complete the quiz without sending a request.
3. `matchingApi.js` sends quiz JSON and validates the response shape. The page
   handles loading, errors, retry, and empty results. Requests time out after 15
   seconds and are cancelled when the page unmounts.
4. FastAPI validates the request using `QuizAnswers`. `cat_repository.py` reads
   eligible rows and converts them into `CatCandidate` objects. `match_cats()`
   filters unavailable, unconfirmed, and archived candidates, scores preferences,
   and returns ranked `matches` and `needs_confirmation` lists.
5. Results show names, preference points, reasons, and unresolved considerations.
   They are suggestions, not adoption approvals or success probabilities.

The current table does not provide confirmed joint-adoption rules or structured
placement restrictions. The adapter keeps those unresolved rather than inferring
them from foster observations or the bonded boolean. Blank care notes remain
unknown. Database candidates therefore appear in the Needs confirmation group.
Cat profile details, photos, bookmarks, and applications are separate features.

## Verification

From the repository root:

```powershell
& .\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

From `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

Backend request tests exercise FastAPI validation, the database adapter, ranking,
availability filtering, safe errors, and CORS, with the database transport mocked.
Frontend tests exercise actual quiz navigation and mocked API responses, including
blocked storage, both result groups, empty results, retry, timeout, and cleanup.
These automated tests do not establish live database credentials or permissions.
Use FastAPI's `/docs` page to try `/matches` against configured real records;
empty results are expected if no records have confirmed availability.
