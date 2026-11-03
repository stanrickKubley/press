# Press page — setup

Free stack: GitHub (stores the posts) + Netlify (hosts the page, runs the editor login).
Her editor lives at `/admin`. Your part takes about 30 minutes, once.

## 1. Personalize (done)
Already set up for Mindy: her name, mindykober.com, her site's menu, colors and fonts.
Delete the two sample posts once it's live (from the editor).

## 2. Put the files on GitHub (5 min)
1. Make a free GitHub account if you don't have one.
2. New repository → name it e.g. `press` → Private is fine → Create.
3. "uploading an existing file" → drag in everything inside this folder → Commit.

## 3. Host it on Netlify (5 min)
1. Sign up at netlify.com with your GitHub account (free plan).
2. Add new site → Import an existing project → GitHub → pick the repo.
   Build settings fill in from `netlify.toml`. Deploy.
3. You get an address like `something.netlify.app`. Open it: the press page should be live.

## 4. Turn on her login (5 min)
In the Netlify site's settings:
1. **Identity** → Enable. Set registration to **Invite only**.
2. Identity → Services → **Git Gateway** → Enable.
3. Identity tab → **Invite users** → her email.

She gets an email, clicks it, sets a password, and lands in the editor.
Her bookmark from then on: `https://press.mindykober.com/admin` (or the netlify.app address until the domain is hooked up).

## 5. Use her domain (10 min, optional)
1. Netlify → Domain management → Add a domain → `press.mindykober.com`.
2. Squarespace → Domains → her domain → DNS → add a **CNAME** record:
   host `press`, value `something.netlify.app`.
3. Wait for it to connect (minutes to a few hours); Netlify adds HTTPS automatically.

## 6. Point her Squarespace "Publications" menu item at it
Her site already has a Publications page. Replace it in the navigation with a **Link** called
"Publications" pointing to https://press.mindykober.com (or keep the old page and just repoint the menu).

## How she uses it
New Entry → fill in Publication, Date, Text, add images (pick a side or leave on Auto)
→ Save (draft) → Publish. The preview on the right is exactly how it'll look. The page
updates about a minute after Publish.

## Changing the look
All of it is in `press.css`. The colors and fonts are the variables at the top.
