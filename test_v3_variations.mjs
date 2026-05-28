import { GoogleAuth } from 'google-auth-library';

const KEY_FILE = 'c:\\Users\\ineti\\Downloads\\project-048abb9f-c292-4139-82e-3f90d3d40daf.json';
const PROJECT_ID = 'project-048abb9f-c292-4139-82e';

async function test(region, modelId) {
    try {
        const auth = new GoogleAuth({
          keyFile: KEY_FILE,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const token = tokenResponse.token;

        const baseUrl = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
        const url = `https://${baseUrl}/v1/projects/${PROJECT_ID}/locations/${region}/endpoints/openapi/chat/completions`;

        const payload = {
          model: modelId,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        };

        console.log(`Testing ${modelId} in ${region}...`);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const bodyText = await response.text();
        console.log(`Status: ${response.status}`);
        console.log(`Data: ${bodyText.substring(0, 200)}`);
        return response.ok;
    } catch (error) {
        console.error('Error:', error.message);
        return false;
    }
}

async function main() {
    await test('global', 'deepseek-ai/deepseek-v3');
    await test('global', 'deepseek-ai/deepseek-v3.2-maas');
}

main();
