const axios = require('axios');

async function testAPI() {
    try {
        console.log('🧪 Testing Spacey API...');
        
        const response = await axios.post('http://localhost:5000/api/chat/spacey', {
            prompt: 'Hello Spacey!',
            user: {
                id: 'test-user',
                email: 'test@example.com'
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Success! API Response:');
        console.log('Status:', response.status);
        console.log('Data:', response.data);

    } catch (error) {
        console.log('❌ API Error:');
        console.log('Message:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
    }
}

testAPI(); 