# Running your own fivepointfive instance

An **instance** is one group's private copy of fivepointfive: a table, a campaign, a group of friends. Everyone in it can see every character and every content pack. Members edit their own characters and packs; the admin can edit anything.

Without any setup, fivepointfive runs in **local-only mode**: everything is saved in the browser and nothing is shared. Follow these steps to make it a shared instance.

You need free accounts on [GitHub](https://github.com), [Vercel](https://vercel.com) and [Supabase](https://supabase.com).

## 1. Create the database

1. In Supabase, create a project (or use an existing one: everything lives in its own `fivepointfive` schema).
2. Open **SQL Editor**, paste the contents of [`supabase/migrations/0001_fivepointfive_instance.sql`](../supabase/migrations/0001_fivepointfive_instance.sql), and run it.
3. Go to **Project Settings → Data API** (or **API**) and add `fivepointfive` to **Exposed schemas**. Save.

## 2. Set up sign-in

fivepointfive uses email and password accounts. Supabase's built-in email service only sends to members of your Supabase team, so pick one:

- **Simplest:** in **Authentication → Sign In / Providers → Email**, turn off **Confirm email**. People can sign up without a confirmation email. That's reasonably safe here, because an account alone can't see anything: only the first person (the admin) and people with an invite link can join.
- **With email:** set up a free email service (Resend, Brevo, Postmark…) under **Authentication → Emails → SMTP Settings** and keep **Confirm email** on. This also makes **Forgot your password?** work on the sign-in page. Without an email service, the admin can reset a member's password from the Supabase dashboard (**Authentication → Users**).

Then in **Authentication → URL Configuration**, set **Site URL** to your site's address (for example `https://fivepointfive.example.com`) and add it under **Redirect URLs** with `/**` on the end (for example `https://fivepointfive.example.com/**`), so confirmation and password reset links can return to any page.

## 3. Deploy the site

1. Fork this repository on GitHub.
2. In Vercel, **Add New → Project**, import your fork, and add these **Environment Variables** (Supabase shows them under **Project Settings → API**):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your project URL, e.g. `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`). Never use the secret/service key. |
| `VITE_SUPABASE_SCHEMA` | Optional. Defaults to `fivepointfive`. |

3. Deploy.

## 4. Claim it and invite people

1. Open your site, choose **Create account**, and sign up. As the first person in, you'll be offered **Become the admin**.
2. Go to **Settings**, create an invite link for each person, and send it however you like. Each link works once and expires after 14 days.
3. Optional: turn on **Shared game log** so everyone's rolls appear live in a table log on every sheet.

## What members can do

| | Member | Admin |
|---|---|---|
| See all characters and content packs | ✓ | ✓ |
| Create characters, make copies of anyone's | ✓ | ✓ |
| Edit or delete their own characters and packs | ✓ | ✓ |
| Edit or delete anyone's characters and packs | | ✓ |
| Upload content packs (.md) | ✓ | ✓ |
| Invite people, remove members, change roles | | ✓ |
| Turn the shared game log on or off | | ✓ |

Permissions are enforced by the database (row-level security), not just the app.

## Local development

Create `.env.local` with the same variables, then `npm run dev`. Leave them out to work in local-only mode.
