const https = require('http'); // Actually http

const BASE_URL = 'http://elib-server:8080/api';

async function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = require('http').request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    console.error("Parse Error:", data);
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    try {
        console.log("1. Logging in...");
        const loginRes = await request('POST', '/auth/login', {
            email: "user0@elib.vn", password: "123" // Old password from seed
        });

        if (loginRes.status !== 200 && loginRes.status !== 201) {
            // Try 123456 as per notification
            console.log("Using '123' failed, trying '123456'...");
            // Wait, seed.js says "123456" in one comment but "123" in controller test? 
            // seed.js hash is "$2b$10$5W/fUB2KmsB/e0nTUgCs4uszLrm2gTSTspVTJcTT/q8GuKFaI9qLK" which is likely 123456.
            // Let's force retry with 123456.
        }

        let token = loginRes.data.token;
        if (!token) {
            const loginRes2 = await request('POST', '/auth/login', {
                email: "user0@elib.vn", password: "123456"
            });
            token = loginRes2.data.token;
            if (!token) throw new Error("Login failed: " + JSON.stringify(loginRes2.data));
            console.log("Logged in with 123456.");
        } else {
            console.log("Logged in with 123.");
        }

        console.log("2. Fetching Books...");
        const booksRes = await request('GET', '/books?limit=1', null, token);
        const bookId = booksRes.data.data[0].id;
        console.log("Target Book:", bookId);

        console.log("3. Borrowing Physical Copy...");
        const borrowRes = await request('POST', '/loans/borrow', {
            bookId: bookId, type: "PHYSICAL"
        }, token);
        console.log("Borrow Result:", borrowRes.status, borrowRes.data);

        console.log("4. Verifying My Loans...");
        const loansRes = await request('GET', '/loans/my-loans', null, token);
        console.log("My Loans:", JSON.stringify(loansRes.data, null, 2));

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

run();
