# Kampit — jury questions and defensible answers

Public product: https://kampit-skills.vercel.app. Public repository: https://github.com/Al1GaTorr/kampit. Team Alias: Ali Qazybai (captain), Dias Saqyp. Current public source: `migration/vercel/`. These answers describe the implemented Skills product; they contain no claimed customer research or sales.

**1. Who is the first buyer?**  
Our first buyer hypothesis is a working adult in the US, aged 25–45, who wants to keep learning after work and repeatedly loses consistency. This is an illustrative starting scenario within the case audience, not a research-derived persona or an exclusion of other adults.

**2. What problem do you solve?**  
The gap between starting a skill and continuing to practice it. Kampit makes the daily commitment explicit, gives it a weekly social context and keeps a record of the person's own completed work. Whether this improves long-term consistency still needs to be tested.

**3. What does a person pay for?**  
The proposed monthly Prime membership opens worldwide competitions. Personal goals and private competitions with friends remain free. The paid benefit is a wider competitive community, not a payment requirement for keeping personal progress.

**4. How much is Prime?**  
We recommend testing **$8 per month as a pricing hypothesis**. It is not a validated price, and the current app has no live billing. Its Prime button grants clearly labeled no-charge demo access, with no card details, charge or recurring subscription. Adjacent accountability product Focusmate lists $8/month billed annually and $12/month billed monthly; that different offer is context, not evidence that users will pay Kampit. [Focusmate pricing](https://www.focusmate.com/pricing/)

**5. Why would a user return tomorrow?**  
The proposed loop is a manageable daily task, visible plan progress, a continuing streak, a weekly shared scoreboard and personal history. These are designed return triggers, not measured retention results. We would observe several complete weeks before claiming an effect.

**6. Why not use a group chat and a spreadsheet?**  
Kampit automates the template commitments, daily task checks, duplicate prevention, scoring cap, weekly standings, next-week level changes and own-work history in one flow. Whether users value that enough to switch or pay is a validation question; we do not assume the answer from technical completion alone.

**7. What is original?**  
Our specific design combines personalized skill templates, different goals in one weekly competition, a daily plan separate from ranked points, transparent verification labels, tied-score safeguards and a saved history of the user's own work. Weekly leagues exist in [Duolingo](https://blog.duolingo.com/duolingo-leagues-leaderboards/) and gamified habits in [Habitica](https://github.com/HabitRPG/habitica). We are not claiming these mechanics are inventions or that no similar product exists.

**8. Can you fairly compare coding, Spanish and writing?**  
The score compares participation under published template rules. Light, Standard and Stretch have fixed values, the selected level stays locked for the week and daily ranked points are capped. It is not an objective ranking of human ability. The perceived fairness and incentives of those rules still need target-user testing.

**9. Can people cheat?**  
The server rejects duplicate template/day credit, other-owner goal access and cap bypass through repeated completion. Quizzes check their actual answers. Written work is checked for length and basic word diversity, while focused practice is self-reported. Those last modes do not establish quality or independently prove the activity.

**10. Is AI grading the work?**  
No. The current build uses authored quiz material and explicit participation checks. It has no AI grading, photo verification, peer-review workflow or certification claim. We do not describe a word-count check as understanding the person's work.

**11. Is the application genuinely live?**  
Yes. The canonical public address is `https://kampit-skills.vercel.app`. It uses native Next.js on Vercel and a real Supabase PostgreSQL database and Auth service. The current hosting plans are Vercel Hobby and Supabase Free in `iad1`; these are current deployment facts, not a claim that costs will stay zero at scale.

**12. What did you actually verify?**  
There were two successful public HTTP runs: 34 unsigned demo requests on the preceding JSONB-fixed build, and 31 account/Auth requests on the current build. The latter registered two distinct synthetic QA accounts through actual Supabase Auth, persisted a checked quiz, rejected foreign-owner access, shared a private two-member group and checked signout/re-login. Separately, the current public browser demo persisted a 3/3 daily plan at 65/100, scheduled a future level, opened own saved history and worked at a 390×844 viewport. This is bounded integration and UI evidence, not customers or all possible-path testing.

**13. How does real registration work?**  
Visitors use email and password. For the hackathon, the user explicitly selected signup on, confirmation email off and anonymous Supabase sign-in off. The server still verifies an immediate session with authoritative `auth.getUser()`. Email ownership, SMTP delivery, password reset and browser signup/login were not verified; the live account test used product HTTP forms and synthetic accounts.

**14. What happens to goals, ranks and ties next week?**  
Users can schedule a permitted level for next week; it does not alter this week's results. Rank movement needs five active days and at least ten eligible same-tier peers. Equal scores share positions. A tied group crossing a promotion or demotion quota stays together. The next-week transition has automated regression evidence; public UI acceptance observed the saved schedule rather than waiting for a real week to pass.

**15. What is missing before you claim a validated business?**  
Evidence that the target audience understands and values the loop, returns over multiple weeks and accepts an explicit paid offer. We also need live billing, operational account recovery/email controls and a measured acquisition channel. At the unvalidated $8/month price, assumed 80% gross margin and six paid months produce $38.40 contribution LTV; assumed $10 CAC yields a 3.84 ratio. $100M ARR would require about 1,041,667 full-year paying-user equivalents. These are scenario calculations, not actual revenue, measured unit economics or market sizing. At only three paid months, the same assumed model falls to $19.20 LTV and a 1.92 ratio.

## Quick clarification if asked about the old deployment

The private Sites/Vinext/D1 app was an earlier deployed variant. It is retained with its old data and ChatGPT access. The public Vercel/Supabase app has a separate account namespace and database; new accounts start empty. There was no old-data import or automatic identity matching.
