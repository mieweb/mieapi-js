```markdown
# mieapi - Usage Guide

This guide provides detailed instructions on how to install and use the **mieapi** npm package for interacting with WebChart Electronic Health Records (EHR) APIs.

## Installation

To install the package, run the following command in your terminal:

```
Local
```bash
npm link mieapi
```

npmjs
```bash
npm install mieapi
```

## Usage

### 1. Instantiating the API Service

To use the `apiService` provided by **mieapi**, first create a new instance by passing in the required parameters:
- `baseUrl`: The base URL of your API.
- `username`: Your username for authentication.
- `password`: Your password for authentication.
- `practice`: The practice name for your organization.

Here’s an example of how to initialize the service:

```javascript
import apiService from 'mieapi';

const apiServiceInstance = new apiService({
  baseUrl: 'https://api.example.com',  // Replace with the actual base URL
  username: 'user123',  // Replace with the actual username
  password: 'securepassword',  // Replace with the actual password
  practice: 'examplePractice'  // Replace with the actual practice name
});
```

### 2. Example: GET Request

To fetch data from the API, use the `get` method provided by the service. For example, you can fetch a list of acceptable IPs as follows:

```javascript
async function testApiService() {
  try {
    const data = await apiServiceInstance.get('acceptable_ips', 'LIKE_id=5&limit=5');
    console.log('GET Response:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testApiService();
```

### 3. Example: POST/PUT Request

To send data to the API, you can use either the `post` or `put` method. Here's an example of how to send a PUT request to update data:

```javascript
const postData = {
  create_datetime: '0000-00-00 00:00:00',
  func: '',
  host_name: '172.27.232.0',
  id: '5',
  ip_address: '15211436',
  security_role_id: '0',
  subnet: '21',
  timeout: '0',
  user_id: '0'
};

async function testApiService() {
  try {
    const postResponse = await apiServiceInstance.put('acceptable_ips', '', postData);
    console.log('PUT Response:', postResponse);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testApiService();
```

### 4. Handling Errors

Each request method (`get`, `post`, `put`) returns a `Promise`, so you can handle errors using `try/catch` as shown in the examples above. Always make sure to log and handle errors appropriately in your application.

## Methods Summary

- `get(endpoint, params)`: Sends a GET request to the specified `endpoint` with optional `params`.
- `post(endpoint, params, data)`: Sends a POST request to the `endpoint` with optional `params` and `data`.
- `put(endpoint, params, data)`: Sends a PUT request to the `endpoint` with optional `params` and `data`.

## License

This project is licensed under the MIE license.

## Contributing

Contributions are welcome! Please feel free to submit issues or fork this repository to contribute improvements.