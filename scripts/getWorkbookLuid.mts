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

const res = await fetch(`${server}/api/3.21/sites/${siteId}/workbooks?pageSize=100`, {
  headers: { 'X-Tableau-Auth': token, 'Accept': 'application/json' }
});
const data = await res.json() as any;
console.log(JSON.stringify(data?.workbooks?.workbook?.map((w: any) => ({ id: w.id, name: w.name })), null, 2));
