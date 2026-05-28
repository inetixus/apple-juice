const fetch = require('node-fetch');
(async () => {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/connect');
    const data = await res.json();
    console.log(JSON.stringify(data));
  } catch (e) {
    console.error('Error:', e);
  }
})();
