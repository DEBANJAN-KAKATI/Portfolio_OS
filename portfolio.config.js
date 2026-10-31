/**
 * portfolio.config.js — sync, privacy and Dev Mode settings.
 *
 * This file is imported by BOTH the browser bundle and the Node sync scripts,
 * so it must never contain secrets. Tokens, password hashes and session
 * secrets live only in GitHub Actions secrets / serverless env vars.
 */
const config = {
  owner: {
    name: 'Debanjan Kakati',
    githubUser: 'DEBANJAN-KAKATI',
    linkedinUrl: 'https://www.linkedin.com/in/debanjan-kakati-5517891b7/',
    // Weather widget shows the owner's weather (Open-Meteo, no API key, no visitor geolocation).
    weather: { label: 'Goa', latitude: 15.4909, longitude: 73.8278 },
  },

  // Where the site and its data live.
  repo: {
    owner: 'DEBANJAN-KAKATI',
    name: 'Portfolio_OS', // change if the portfolio repo has a different name
    branch: 'main',
  },

  sync: {
    // "pr" = open a pull request for every sync, "auto" = commit straight to the branch.
    reviewMode: 'pr',
    // Repos never imported as drafts (unless they carry the "portfolio" topic).
    excludeRepos: ['DEBANJAN-KAKATI'],
    // GitHub topic that always opts a repo in.
    includeTopic: 'portfolio',
    // Drafts are hidden from visitors until approved in Studio or by merging the sync PR.
    showDraftsToVisitors: false,
    // How many README characters to keep for the excerpt.
    readmeExcerptChars: 400,
    // Projects added in the most recent sync get a "NEW" badge.
    newBadge: true,
    // Multipliers for GitHub language bytes in the Skills "usage %". Notebook files
    // mostly hold cell outputs, so counting them at full size would dwarf real code.
    languageWeights: { 'Jupyter Notebook': 0.02, HTML: 0.5 },
  },

  privacy: {
    // Email is shown only when true; otherwise the contact form is the only channel.
    showEmail: false,
    showGpa: true,
    // Phone is never published, regardless of this file.
  },

  contact: {
    // 'formspree' | 'emailjs'
    provider: 'formspree',
    formspreeId: 'your-form-id', // public form id, not a secret
    emailjs: { serviceId: '', templateId: '', publicKey: '' },
  },

  devMode: {
    enabled: true,
    sessionHours: 12,
    // 'repo' commits images to public/media/, 'vercel-blob' | 'r2' for videos and 3D models.
    imageStorage: 'repo',
    largeMediaStorage: 'vercel-blob',
    maxImageBytes: 5 * 1024 * 1024,
    maxImageDimension: 2560,
  },

  // Live "Check for updates" in the Windows Update app (unauthenticated GitHub API).
  liveUpdateCheck: {
    enabled: true,
    cacheMinutes: 30,
  },
};

export default config;
