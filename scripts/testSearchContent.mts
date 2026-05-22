import dotenv from 'dotenv';
dotenv.config({ path: 'env.list' });

const server = process.env.SERVER;
const site = process.env.SITE_NAME;
const patName = process.env.PAT_NAME;
const patValue = process.env.PAT_VALUE;

const signinRes = await fetch(`${server}/api/3.21/auth/signin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({ credentials: { personalAccessTokenName: patName, personalAccessTokenSecret: patValue, site: { contentUrl: site } } })
});
const signin = await signinRes.json() as any;
const token = signin.credentials.token;
const siteId = signin.credentials.site.id;

const res = await fetch(`${server}/api/-/sites/${siteId}/search?terms=customer+support&limit=20`, {
  headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' }
});
const data = await res.json() as any;
console.log('All items:');
data?.hits?.items?.forEach((i: any) => {
  console.log(`type=${i.content?.type} title=${i.content?.title} containerName=${i.content?.containerName} containerId=${i.content?.containerId} luid=${i.content?.luid}`);
});
