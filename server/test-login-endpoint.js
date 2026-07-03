const axios = require('axios');

async function testLogin() {
  console.log('\n=== TESTING LOGIN ENDPOINT ===\n');
  
  const apiBaseUrl = 'http://localhost:3000';
  
  const testCases = [
    { email: 'sam@gmail.com', password: 'samPassword' },
    { email: 'okay@gmail.com', password: 'okayPassword' }
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing login: ${testCase.email}`);
    
    try {
      const response = await axios.post(`${apiBaseUrl}/login`, {
        email: testCase.email,
        password: testCase.password
      });
      
      console.log(`Status: ${response.status}`);
      console.log(`Response:`, JSON.stringify(response.data, null, 2));
    } catch (err) {
      if (err.response) {
        console.log(`Status: ${err.response.status}`);
        console.log(`Response:`, JSON.stringify(err.response.data, null, 2));
      } else {
        console.log(`Error: ${err.message}`);
      }
    }
    
    console.log('');
  }
  
  process.exit(0);
}

testLogin();
