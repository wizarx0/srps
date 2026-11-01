# SRPS

Smart Result Processing System, built with React, Vite, and Supabase.

## Deploy to Vercel

1. Import this repository into Vercel and select the **Vite** framework preset.
2. Set the build command to `npm run build` and the output directory to `dist`.
3. Add these environment variables in the Vercel project settings for every deployment environment:
   - `VITE_SUPABASE_URL` — the Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — the Supabase publishable key.
4. Deploy the project. `vercel.json` sends client-side routes to the app entry point so direct links and page refreshes work.

The same variables can be copied from `.env.example` into a local `.env.local` file for development. Do not put a Supabase service-role key or other server secrets in a `VITE_` variable; Vite exposes those values to browsers.

Vercel hosts the frontend only. Apply the Supabase migrations and deploy the required Supabase Edge Functions separately, and configure the Supabase Auth site URL and redirect URLs to include the deployed Vercel domain.
