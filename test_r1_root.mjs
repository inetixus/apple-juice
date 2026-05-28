import { GoogleAuth } from 'google-auth-library';

const KEY_FILE = 'c:\\Users\\ineti\\Downloads\\project-048abb9f-c292-4139-82e-3f90d3d40daf.json';
const PROJECT_ID = 'project-048abb9f-c292-4139-82e';
const REGION = 'us-central1';
const MODEL_ID = 'deepseek-ai/deepseek-r1';

async function testDeepSeekR1() {
  try {
    const auth = new GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    if (!token) {
      throw new Error('Failed to generate access token');
    }

    console.log('Access token generated.');

    const baseUrl = REGION === 'global' ? 'aiplatform.googleapis.com' : `${REGION}-aiplatform.googleapis.com`;
    const url = `https://${baseUrl}/v1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/openapi/chat/completions`;

    const payload = {
      model: MODEL_ID,
      messages: [
        { role: 'user', content: 'Hello DeepSeek R1, are you working?' }
      ],
    };

    console.log('Sending request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response Data:', bodyText);
  } catch (error) {
    console.error('Detailed Error:', error);
  }
}

testDeepSeekR1();
