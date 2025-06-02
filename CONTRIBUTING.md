# Contributing to Bot System

Thank you for your interest in contributing to the Bot System! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git
- Basic knowledge of TypeScript, Redis, and microservices

### Setting up Development Environment

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/japm-bots.git
   cd japm-bots
   ```

2. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env file with your configuration
   ```

3. **Start development environment**
   ```bash
   ./scripts/start.sh
   ```

4. **Verify setup**
   ```bash
   ./scripts/test.sh
   ```

## Development Process

### Branch Strategy

- `main` - Production ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches
- `bugfix/*` - Bug fix branches
- `hotfix/*` - Critical fixes

### Workflow

1. Create a feature branch from `develop`
2. Make your changes
3. Write/update tests
4. Update documentation
5. Submit a pull request

### Local Development

#### Working on a Service

Each service can be developed independently:

```bash
# API Gateway
cd packages/api-gateway
npm install
npm run dev

# Workers
cd packages/workers
npm install
npm run dev
```

#### Running Tests

```bash
# Unit tests
npm test

# Integration tests
./scripts/test.sh

# Load testing
./scripts/load-test.sh
```

#### Debugging

View logs for specific services:
```bash
docker-compose logs -f api-gateway
docker-compose logs -f orchestrator
docker-compose logs -f workers
```

## Pull Request Process

### Before Submitting

1. **Update documentation** - Ensure README.md and other docs are current
2. **Write tests** - Add tests for new functionality
3. **Check code quality** - Run linting and formatting
4. **Test thoroughly** - Verify your changes work as expected
5. **Update changelog** - Add entry to CHANGELOG.md

### PR Requirements

- **Clear description** - Explain what changes you made and why
- **Linked issues** - Reference any related issues
- **Tests pass** - All tests must pass
- **Documentation** - Update relevant documentation
- **No merge conflicts** - Rebase if necessary

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## Coding Standards

### TypeScript

- Use strict mode
- Prefer `interface` over `type`
- Use async/await over Promises
- Add proper error handling
- Include JSDoc for complex functions

### File Structure

```
packages/
├── common/           # Shared code
├── api-gateway/      # API Gateway service
├── orchestrator/     # Orchestrator service
├── workers/          # Worker services
├── webhook-manager/  # Webhook manager
└── mock-webhook/     # Testing webhook
```

### Naming Conventions

- Files: `kebab-case.ts`
- Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)

### Code Style

```typescript
// Good
interface BotTask {
  id: string;
  botType: 'python' | 'node' | 'java';
  payload: Record<string, any>;
}

async function processBotTask(task: BotTask): Promise<void> {
  try {
    // Implementation
  } catch (error) {
    console.error('Failed to process bot task:', error);
    throw error;
  }
}

// Avoid
function process_bot_task(task: any) {
  // No error handling
  // No types
}
```

## Testing

### Test Categories

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test service interactions
3. **E2E Tests** - Test complete workflows

### Writing Tests

```typescript
describe('BotTask Processing', () => {
  it('should process valid bot task', async () => {
    const task: BotTask = {
      id: 'test-1',
      botType: 'node',
      payload: { test: true }
    };
    
    const result = await processBotTask(task);
    expect(result.success).toBe(true);
  });
  
  it('should handle invalid bot type', async () => {
    const task = { botType: 'invalid' } as BotTask;
    
    await expect(processBotTask(task)).rejects.toThrow();
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- Test error conditions
- Test edge cases
- Mock external dependencies

## Documentation

### Code Documentation

- Add JSDoc for public APIs
- Comment complex logic
- Include examples for interfaces

```typescript
/**
 * Processes a bot task with semaphore control
 * @param task - The bot task to process
 * @param semaphore - Semaphore for concurrency control
 * @returns Promise resolving to execution result
 * @throws {Error} When bot type is unsupported
 */
async function processBotTask(
  task: BotTask,
  semaphore: Semaphore
): Promise<BotResult> {
  // Implementation
}
```

### API Documentation

- Document all endpoints
- Include request/response examples
- Note authentication requirements
- Specify error codes

### README Updates

When adding features:
- Update feature list
- Add usage examples
- Update configuration sections
- Include troubleshooting info

## Performance Guidelines

### Optimization Tips

- Use connection pooling for Redis
- Implement proper cleanup
- Monitor memory usage
- Use appropriate queue settings
- Profile critical paths

### Monitoring

- Add metrics for new features
- Include timing information
- Monitor error rates
- Track resource usage

## Security Considerations

- Validate all inputs
- Use parameterized queries
- Implement rate limiting
- Secure webhook endpoints
- Handle sensitive data properly

## Getting Help

- **Issues** - Create GitHub issues for bugs/features
- **Discussions** - Use GitHub discussions for questions
- **Documentation** - Check existing docs first
- **Code Review** - Ask for feedback early

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- README.md acknowledgments
- Release notes

Thank you for contributing to Bot System! 🤖 