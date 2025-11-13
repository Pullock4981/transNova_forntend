# Testing Documentation

## Overview

This project uses **Jest** as the testing framework with **Supertest** for HTTP endpoint testing. Tests use an in-memory MongoDB database (via `mongodb-memory-server`) to ensure isolated, fast test execution.

## Test Structure

```
tests/
├── helpers/
│   ├── testDb.js          # Database setup/teardown utilities
│   └── authHelper.js      # Authentication test helpers
├── integration/           # Integration tests (API endpoints)
│   ├── auth.test.js
│   ├── users.test.js
│   ├── jobs.test.js
│   ├── resources.test.js
│   ├── recommendations.test.js
│   ├── dashboard.test.js
│   └── health.test.js
├── unit/                  # Unit tests (services, utilities)
│   └── recommendationService.test.js
├── setup.js               # Jest setup configuration
└── README.md              # This file
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run tests with verbose output
```bash
npm run test:verbose
```

## Test Coverage

The test suite covers:

### Authentication (11 tests)
- User registration (success, validation errors)
- User login (success, invalid credentials)
- Token verification (valid, invalid, missing)

### User Routes (9 tests)
- Get current user profile
- Update user profile
- Update skills array
- Update career interests
- Store CV text
- Save jobs and resources

### Job Routes (8 tests)
- Get all jobs
- Filter jobs by track, location, type, experience level
- Get job by ID
- Error handling (404, 400)

### Resource Routes (5 tests)
- Get all resources
- Get resource by ID
- Error handling

### Recommendation Routes (5 tests)
- Job recommendations based on skills
- Resource recommendations based on skills/interests
- Authentication requirements

### Dashboard Route (5 tests)
- Complete dashboard data
- User profile, recommendations, saved items
- Authentication requirements

### Recommendation Service (5 tests)
- Job recommendation algorithm
- Resource recommendation algorithm
- Edge cases (empty skills, sorting)

### Health Check (1 test)
- Server health endpoint

**Total: 50 tests** ✅

## Test Features

### In-Memory Database
- Uses `mongodb-memory-server` for isolated test database
- No need for external MongoDB instance
- Fast test execution
- Automatic cleanup between tests

### Authentication Helpers
- `createTestUser()` - Create test user with token
- `generateTestToken()` - Generate JWT tokens
- `getAuthHeader()` - Get authorization header

### Database Helpers
- `connectTestDB()` - Connect to test database
- `closeTestDB()` - Close database connection
- `clearTestDB()` - Clear all collections

## Writing New Tests

### Example: Integration Test

```javascript
const request = require('supertest');
const app = require('../../app');
const { connectTestDB, closeTestDB, clearTestDB } = require('../helpers/testDb');
const { createTestUser, getAuthHeader } = require('../helpers/authHelper');

describe('My Feature', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('should do something', async () => {
    const { user, token } = await createTestUser();
    
    const response = await request(app)
      .get('/api/endpoint')
      .set(getAuthHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

## Test Configuration

- **Jest Config**: `jest.config.js`
- **Test Timeout**: 10 seconds
- **Test Environment**: Node.js
- **Coverage**: Excludes seed scripts and config files

## Environment Variables for Testing

Tests use `.env.test` file (if exists) or default test values:
- `MONGO_URI`: Uses in-memory database (automatic)
- `JWT_SECRET`: `test-jwt-secret-key-for-testing-only`
- `JWT_EXPIRE`: `1h`
- `NODE_ENV`: `test`

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Database is cleared before each test
3. **Async/Await**: Always use async/await for database operations
4. **Assertions**: Use descriptive expect statements
5. **Error Cases**: Test both success and error scenarios

## Troubleshooting

### Tests failing with database connection errors
- Ensure `mongodb-memory-server` is installed
- Check that port is not in use

### Tests timing out
- Increase timeout in `jest.config.js`
- Check for hanging database connections

### Coverage not generating
- Run `npm run test:coverage`
- Check `coverage/` directory

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- No external dependencies required
- Fast execution (< 10 seconds)
- Deterministic results
- Isolated test environment

