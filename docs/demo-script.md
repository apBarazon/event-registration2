# Live Demo Script (follows the manual's 7 steps, in order)

## Before your time slot
- [ ] Run one full green build the day before so every image is cached.
- [ ] Start the production stack and open the site (http://localhost:4000). Note the footer build number (call it **N**).
- [ ] Create demo data: sign up as a normal user, register for an event, open My Registrations. This is the data you will show again in step 6.
- [ ] Open tabs: the site, the Jenkins job page, the GitHub repo.
- [ ] Terminal open in the repository folder. Have the two edits below ready but not committed.
- [ ] Be sure at least three releases exist (`docker images evt-web`), so there is an older one to roll back to.
- [ ] Decide who drives the keyboard and who narrates each step.

## Steps

**1. Show the running system.**
```
docker compose -p evt ps
```
Four containers, all healthy, only the proxy has a port (4000). In the browser, point out the footer: `Build N`.

**2. Make a visible code change and push.** In `client/src/pages/EventList.jsx` change the heading:
```
<h1>Upcoming events</h1>   ->   <h1>Upcoming events (v2)</h1>
```
```
git add .
git commit -m "demo: change heading"
git push origin main
```

**3. Show Jenkins starting by itself.** Do not click Build. Open the job page; the poll starts a build within about 2 minutes. While it runs, walk through the Stage View: install, unit tests, image build, test stack, health checks, end-to-end tests, deploy, verify. Explain that the tests run on a separate copy before anything touches the live site.

**4. Show the change is live.** Hard refresh the browser (Ctrl+F5). The heading says "(v2)" and the footer shows the new build number.

**5. Break a test, show the gate, then repair.** In `server/src/app.js` change `>=` to `>` in this line:
```
if (rows[0].registered >= rows[0].capacity) return res.status(409).json({ error: 'Event is full' });
```
```
git add . && git commit -m "demo: break capacity check" && git push origin main
```
The build turns red at **Unit Test**; later stages are skipped. Refresh the site: it still shows the previous build number and works. Then repair:
```
git revert HEAD --no-edit
git push origin main
```
The pipeline passes again and deploys. (A failed build still uses up a build number, so numbers can skip.)

**6. Show data persistence.** Log in with the demo user and open My Registrations: the registration created before the demo is still there after three deployments, because the database lives in the named volume `evt-db-data`.

**7. Show a rollback.** In Jenkins click **Build with Parameters**, enter an earlier release number in `ROLLBACK_TAG` (for example the number you noted in step 1) and Build. It skips build and test and redeploys those images. Refresh: the heading is back to "Upcoming events" and the footer shows the older number. Only the three newest releases are kept, so choose one of those.

## Timing and fallbacks
- One full pipeline run takes a few minutes, and the demo needs three (change, break, repair) plus a quick rollback. If the demo must fit inside the 10 minutes, start the step 2 push right at the beginning of your slot and present slides 3 to 11 while it runs, then come back for steps 4 to 7. Ask your instructor in advance how they count the time.
- To avoid waiting up to 2 minutes for the poll, you can change the trigger to `pollSCM('* * * * *')` in the Jenkinsfile for demo day, or use the GitHub webhook if you set one up. Jenkins prints a note about spreading the load, which is fine.
- If the network is slow, keep screenshots of a green run, a red run, the footer after each deploy and the rollback as slides 13 backups.
- If something breaks live, say what you see and open the failed stage log; explaining a failure calmly scores better than hiding it.