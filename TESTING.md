# Testing Guide

This document provides comprehensive information about the testing infrastructure for the Kizomba Platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Test Framework](#test-framework)
3. [Running Tests](#running-tests)
4. [Test Structure](#test-structure)
5. [Writing Tests](#writing-tests)
6. [Code Coverage](#code-coverage)
7. [CI/CD Integration](#cicd-integration)

---

## Overview

The platform uses **Vitest** as the primary testing framework, providing:
- Fast test execution with HMR
- Jest-compatible API
- TypeScript support out of the box
- React Testing Library integration
- Coverage reporting

---

## Test Framework

### Tech Stack

- **Vitest**: Test runner and framework
- **@testing-library/react**: Component testing utilities
- **@testing-library/jest-dom**: Custom matchers
- **jsdom**: Browser environment simulation

### Configuration

Test configuration is defined in `vitest.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

---

## Running Tests

### Available Commands

```bash
npm run test              # Run tests in watch mode
npm run test:ui           # Run tests with UI interface
npm run test:coverage     # Generate coverage report
```

### Watch Mode

In watch mode, tests automatically re-run when files change:

```bash
npm run test
```

Press `h` in the terminal to see available commands:
- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename
- `t` - Filter by test name
- `q` - Quit watch mode

### UI Mode

For a graphical interface:

```bash
npm run test:ui
```

This opens a browser with an interactive test explorer.

---

## Test Structure

```
src/tests/
├── setup.ts                    # Global test setup
├── utils/
│   └── validators.test.ts     # Utility function tests
├── components/
│   └── FavoriteButton.test.tsx # Component tests
└── integration/
    └── rls-policies.test.ts   # Integration tests
```

### Test Categories

#### 1. Unit Tests
Location: `src/tests/utils/`

Test individual functions and utilities in isolation.

**Example**:
```typescript
describe('Email Validation', () => {
  it('should validate correct email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
});
```

#### 2. Component Tests
Location: `src/tests/components/`

Test React components with user interactions.

**Example**:
```typescript
describe('FavoriteButton', () => {
  it('should render favorite button', () => {
    render(<FavoriteButton itemId="test" itemType="video" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

#### 3. Integration Tests
Location: `src/tests/integration/`

Test interactions between multiple components or systems.

**Example**:
```typescript
describe('RLS Policy Tests', () => {
  it('should restrict profile access to authenticated users', async () => {
    // Test database security policies
  });
});
```

---

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

function calculateTotal(items: { price: number; quantity: number }[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

describe('calculateTotal', () => {
  it('should calculate total for multiple items', () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 3 },
    ];
    expect(calculateTotal(items)).toBe(35);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

### Component Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Async Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import UserProfile from './UserProfile';

describe('UserProfile', () => {
  it('should load and display user data', async () => {
    render(<UserProfile userId="123" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
```

### Mocking Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: '1' } })),
        })),
      })),
    })),
  },
}));

describe('Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user profile', async () => {
    const profile = await fetchProfile('user-id');
    expect(profile).toEqual({ id: '1' });
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });
});
```

---

## Code Coverage

### Generating Coverage Reports

```bash
npm run test:coverage
```

This generates three types of reports:
- **Terminal**: Summary in console
- **JSON**: Machine-readable report
- **HTML**: Interactive web report in `coverage/index.html`

### Coverage Thresholds

Configure minimum coverage requirements in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
}
```

### Coverage Exclusions

The following are excluded from coverage:
- `node_modules/`
- `src/tests/`
- `**/*.d.ts`
- `**/*.config.*`
- `dist/`

---

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// ❌ Bad
it('works', () => {});

// ✅ Good
it('should calculate total price including tax', () => {});
```

### 2. Arrange-Act-Assert Pattern

Structure tests with clear sections:

```typescript
it('should add item to cart', () => {
  // Arrange
  const cart = new Cart();
  const item = { id: '1', price: 10 };

  // Act
  cart.addItem(item);

  // Assert
  expect(cart.items).toHaveLength(1);
  expect(cart.total).toBe(10);
});
```

### 3. Test One Thing

Each test should verify one specific behavior:

```typescript
// ❌ Bad - Testing multiple things
it('should handle cart operations', () => {
  cart.addItem(item);
  cart.removeItem(item.id);
  cart.clear();
  // Too many assertions
});

// ✅ Good - Separate tests
it('should add item to cart', () => {
  cart.addItem(item);
  expect(cart.items).toHaveLength(1);
});

it('should remove item from cart', () => {
  cart.addItem(item);
  cart.removeItem(item.id);
  expect(cart.items).toHaveLength(0);
});
```

### 4. Clean Up After Tests

Use `beforeEach` and `afterEach` to maintain test isolation:

```typescript
describe('Cart', () => {
  let cart: Cart;

  beforeEach(() => {
    cart = new Cart();
  });

  afterEach(() => {
    cart.clear();
  });

  it('should add item', () => {
    cart.addItem(item);
    expect(cart.items).toHaveLength(1);
  });
});
```

### 5. Use Meaningful Assertions

```typescript
// ❌ Bad
expect(result).toBeTruthy();

// ✅ Good
expect(result).toBe(true);
expect(cart.items).toHaveLength(3);
expect(user.email).toBe('user@example.com');
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Debugging Tests

### VS Code Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Chrome DevTools

```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs
```

Then open `chrome://inspect` in Chrome.

---

## Common Testing Patterns

### Testing Forms

```typescript
it('should submit form with valid data', async () => {
  const handleSubmit = vi.fn();
  render(<LoginForm onSubmit={handleSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

  expect(handleSubmit).toHaveBeenCalledWith({
    email: 'user@example.com',
    password: 'password123',
  });
});
```

### Testing API Calls

```typescript
it('should fetch and display videos', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve([
        { id: '1', title: 'Video 1' },
        { id: '2', title: 'Video 2' },
      ]),
    })
  );

  render(<VideoList />);

  await waitFor(() => {
    expect(screen.getByText('Video 1')).toBeInTheDocument();
    expect(screen.getByText('Video 2')).toBeInTheDocument();
  });
});
```

### Testing Context Providers

```typescript
it('should access context values', () => {
  render(
    <AuthProvider>
      <ComponentUsingAuth />
    </AuthProvider>
  );

  expect(screen.getByText('Logged in')).toBeInTheDocument();
});
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Test-Driven Development Guide](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

---

## Troubleshooting

### Tests Not Running

1. Check that `vitest` is installed: `npm list vitest`
2. Verify `vitest.config.ts` exists
3. Clear cache: `rm -rf node_modules/.vite`

### Import Errors

Add path alias to `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Mock Issues

Ensure mocks are defined before imports:

```typescript
vi.mock('./module', () => ({
  default: vi.fn(),
}));

import { Component } from './module';
```

---

**Last Updated**: December 29, 2024
