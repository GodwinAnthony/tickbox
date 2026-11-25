# ✓ TickBox

Free, self-hosted live polling for big rooms — a Mentimeter-style app with no 50-person limit.
Tested with **250 simultaneous participants** (default cap: 300, change with `MAX_PARTICIPANTS`).

## What it does
**Presenter** (`/host`) builds slides and presents them on the projector. **Audience** joins on their phones at `/join` by scanning the QR code or typing the 6-digit code. No accounts, no app install.

| Slide type | Big screen shows |
|---|---|
| 📊 Multiple choice | Animated bar columns with counts and % |
| ☁️ Word cloud | Words grow and rearrange as more people say them |
| 💬 Open ended | Sticky-note wall, new answers pop in (click ✕ to hide one) |
| 🎚️ Scales | Average marker slides along each statement, with spread |
| 🏅 Ranking | Items reorder live by preference |
| ⚡ Quiz | Countdown timer, Kahoot-style tiles, points for speed, reveal |
| 🏆 Leaderboard | Top 10 by quiz points, animated |
| 🙋 Q&A | Audience asks + upvotes, mark questions answered |
| 📝 Heading | Title / info slide |
| 🚪 Lobby | Big QR + join code, players' names pop in |

**Quiz flow (press Space to step through):** Lobby → "Question N of M" → 4-second "get ready" countdown → answer tiles with timer → reveal → animated leaderboard (bars start in the old order, the new points grow out of each bar, scores count up, then players overtake) → next question → final leaderboard: podium for the top 3 (rising 3rd → 2nd → 1st) with places 4–10 beside it, a crown and confetti for the winner. Correct answers score 500–1000 points: the faster, the more. Paste many questions at once with **Paste quiz questions** (put `*` before the correct answer).

**Design:** four slide themes (Light, White, Dark, Midnight) in the Design panel; **Preview** shows the deck full-screen without an audience.

Plus: floating emoji reactions, hide results, close voting, show results on phones, reset a slide, CSV export, fullscreen, big QR (press **Q**).

**Keyboard while presenting:** → / Space next · ← previous · H hide results · Q big QR · F fullscreen

## Run it on your laptop
```bash
npm install
npm start
# open http://localhost:3000/host
```
Phones on the same Wi-Fi can join at `http://<your-laptop-IP>:3000/join`.

## Put it online for free (Render)
1. Push this folder to a GitHub repo.
2. On render.com → **New → Blueprint** → pick the repo (it reads `render.yaml`).
   Or **New → Web Service**: Build `npm install`, Start `npm start`, Instance type **Free**.
3. Share `https://<your-app>.onrender.com/join` — the presenter page is `/host`.

> Free Render instances sleep when idle. Open your site a minute or two before you present so it's awake.
> Sessions live in server memory: a restart/redeploy ends any live session (your slides are safe — they're saved in your browser).

## Load test
```bash
npm start                      # terminal 1
node loadtest.js http://localhost:3000 250   # terminal 2
```
Simulates 250 phones joining, voting on multiple choice / word cloud / quiz / open ended, and spamming reactions.

## How it handles 250+ people
- Votes are counted on the server; the big screen gets **one batched update every 200 ms** instead of one per vote.
- Phones get result updates at most once per second, and only when "Results on phones" is on.
- Reactions are rate-limited per person and batched.
- Each phone keeps a private ID, so refreshing doesn't create duplicate votes.

## Files
```
server.js          Express + Socket.IO server, rooms, scoring, CSV export
public/index.html  Landing page + join box
public/host.html   Editor + presenter mode   (js/host.js)
public/join.html   Phone voting app          (js/audience.js)
public/js/viz.js   All animated visualisations (shared)
public/css/app.css Styles
loadtest.js        250-participant simulation
```
