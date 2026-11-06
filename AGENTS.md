# Front-end updates

After changing public HTML, CSS, JavaScript, PHP or assets, run
`node scripts/version-assets.cjs` before finishing the task. This updates local
asset URLs, including every JavaScript module import, with one content-based
version. Include all resulting changes in the deployment/commit when requested.
Run it a second time to check that it reports zero changed files.

Verify the affected pages with these versioned URLs. Do not add versions to API
requests, external resources or navigation links. Never modify or version private
data or credentials as part of cache updates.
