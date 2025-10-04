const axios = require('axios');

const BASE_URL = 'https://us-central1-tayyari-hub.cloudfunctions.net/generateInitialLeaderboard';

async function runBatches() {
  let startAfter = null;
  let batch = 1;

  while (true) {
    let url = BASE_URL;
    if (startAfter) {
      url += `?startAfter=${encodeURIComponent(startAfter)}`;
    }
    console.log(`Running batch ${batch}: ${url}`);
    try {
      const res = await axios.get(url);
      console.log('Response:', res.data);

      // Check if we've finished
      if (typeof res.data === 'string' && res.data.includes('No more users to process')) {
        console.log('All batches completed!');
        break;
      }

      // Extract next startAfter from response
      const match = res.data.match(/startAfter=([\w-]+)/);
      if (match) {
        startAfter = match[1];
        batch++;
      } else {
        console.error('Could not find next startAfter in response!');
        break;
      }
    } catch (err) {
      console.error('Error in batch:', err.response?.data || err.message);
      break;
    }
  }
}

runBatches();