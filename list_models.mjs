import { GoogleAuth } from 'google-auth-library';

const KEY_FILE = 'c:\\Users\\ineti\\Downloads\\project-048abb9f-c292-4139-82e-3f90d3d40daf.json';
const PROJECT_ID = 'project-048abb9f-c292-4139-82e';

async function listModels() {
  try {
    const auth = new GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const regions = ['global', 'us-central1', 'europe-west4'];
    
    for (const region of regions) {
        console.log(`--- Checking region: ${region} ---`);
        const baseUrl = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
        // List publisher models
        const url = `https://${baseUrl}/v1/projects/${PROJECT_ID}/locations/${region}/publishers/deepseek-ai/models`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Data: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
    }

  } catch (error) {
    console.error('Detailed Error:', error);
  }
}

listModels();
