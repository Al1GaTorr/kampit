# Kampit — presentation script

**Target:** 4 minutes 45 seconds, including a 90-second live demo. Rehearse with the final build; the timings are a speaking plan, not a measured rehearsal result.

**Public product:** https://kampit-skills.vercel.app  
**Track / model:** Skills / B2C  
**Public repository:** https://github.com/Al1GaTorr/kampit  
**Team:** Alias — Ali Qazybai (captain) and Dias Saqyp.

## Before presenting

Open the public app and start an explicitly labeled interactive demo. Its participants, previous-week history and sample writing are fictional; current actions use the actual deployed server and database. Prepare two of the three daily demo goals, leaving one existing Standard quiz unfinished. Do not add Spanish or JavaScript again when they are already active. The final live quiz can then demonstrate a complete daily plan below the 100-point cap. Show the actual observed score, which can vary; the acceptance run recorded 3/3 goals at 65/100.

Keep a completed prior-week detail ready for the history step. Use a saved sample submission only inside the labeled demo. New real accounts begin empty and have no fabricated past weeks. Do not perform an unprepared signup flow during the timed demo; registration is available at `/login`.

## 0:00–0:35 — One person, one problem

“Meet a working adult who wants to improve a skill after work. On Monday, they start with a clear goal. By Thursday, work and daily life have taken over, and practice disappears. This is our first buyer hypothesis, within the challenge's US audience aged 25 to 45. We have not validated this persona through interviews yet. Kampit is built around one job: make the next small practice session worth showing up for.”

## 0:35–1:05 — The product

“Kampit turns personal learning goals into daily practice and weekly competition. You choose a ready-made skill template and a realistic level. Friends can bring different learning goals into one private scoreboard. Your daily plan shows what you committed to, while ranked points have a separate cap. The plan can be finished without chasing 100 points. A weekly cycle, saved work and a continuing rank give the product a reason to be opened again.”

## 1:05–2:35 — Live demo, 90 seconds

| Demo time | Action | Suggested narration |
| --- | --- | --- |
| 0–8 seconds | Show the public URL and demo banner. | “These are fictional demo participants and sample history. The task and score update are real server operations.” |
| 8–30 seconds | Open the existing unfinished Standard quiz, answer it and submit. | “The commitment and points are visible before I start. These answers are checked on the server.” |
| 30–40 seconds | Show the completed daily plan, separate points/100 panel and reload. | “My plan is complete. The ranking limit is separate, and the result survives a reload.” |
| 40–55 seconds | Schedule a different level for next week. Show current and pending levels with the exact start. | “I can adjust next week's commitment without changing this week's rules or old results.” |
| 55–75 seconds | Open Your week and expand one own saved writing record. | “I can review my own practice and original prompt. This previous week is clearly labeled fictional demo history.” |
| 75–90 seconds | Show the friends board, then the global competition preview or Prime gate. | “Friends compete for free. Global access is the proposed paid layer. Prime in this build is no-charge demo access.” |

If a request fails, identify the failure. A local preview or captured screenshot is a fallback, not a live public interaction. Do not fill a delay with invented user results.

## 2:35–3:10 — What actually works

“The public app runs on native Next.js, Supabase PostgreSQL and Supabase Auth, hosted on Vercel. It stores goals, submissions, memberships and score events. Ownership, duplicate prevention and the daily cap are enforced by the server. We tested the public demo in desktop and mobile browsers and used two synthetic accounts to test the actual signup, login and private invitation path over HTTP. Those are integration tests, not customers or retention evidence.”

## 3:10–4:05 — Why people return and what we sell

“The free loop is personal practice and friends. We propose testing Prime at eight dollars a month for the global league. An illustrative model—six paid months, an eighty percent gross margin and ten dollars acquisition cost—gives thirty-eight dollars forty in contribution lifetime value, or 3.84 times acquisition cost. These inputs are assumptions, not measurements. At that price, a hundred million dollars in annual recurring revenue would require about 1.04 million paying subscribers. That is scale arithmetic, not market validation. Our next commercial test is a multi-week target-user cohort and an explicit paid offer.”

## 4:05–4:45 — Our design choice and next step

“Our design choice is to combine different personal skill goals with transparent weekly rules: a fixed commitment for this week, a separate daily cap, fair handling of tied scores and access to your own past work. Points describe participation under those rules; they do not certify skill. Quizzes check authored answers, writing checks a submitted response, and focus practice is self-reported. We now have a public working loop. Our next step is to test its value, fairness and willingness to pay with the people it is intended to help.”

Finish on the actual dashboard or leaderboard. The closing line is: **“Kampit: keep showing up for your next skill.”**

## Evidence and wording guardrails

- The two successful live HTTP runs contain 65 requests across two builds: 34 unsigned demo requests on `6i7i50j4f`, then 31 account/Auth requests on current `c7a4y1cpe`. Do not call this one 65-request regression of the final build.
- The current public browser run used only an isolated fictional demo. Browser signup/login, customer use, SMTP delivery, password reset and email ownership were not verified. Email confirmation is intentionally off under the user's selected hackathon setting.
- Prime creates no real charge or subscription. **$8/month is a hypothesis to test.** No interview result, paid traction, CAC, LTV or sustained-retention outcome has been observed.
- Scenario inputs are $10 CAC, 80% gross margin and six paid months: contribution LTV = $8 × 0.8 × 6 = $38.40; LTV/CAC = 3.84. The simplified model excludes fixed operating costs and is not an observed profitability result. $100M / ($8 × 12) ≈ 1,041,667 continuously paying-user equivalents; this is not a researched market size.
- The public stack is native Next.js + Supabase + Vercel. The older private Sites/D1 app is a separate retained variant; its old data was not imported.
- Use `submission/jury-qa.md` for detailed answers and `submission/form-answers.md` for copy. The inspected form requests a PDF deck up to 20MB, a public product URL and a public GitHub URL; it does not request a video. The captain/roster is coordinator-confirmed for team Alias.
