import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  const mockUser1 = {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser2 = {
    id: 'user-2',
    name: 'Bob',
    email: 'bob@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should render nothing when no users are typing', () => {
    const { container } = render(<TypingIndicator typingUsers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should filter out current user from typing list', () => {
    const { container } = render(
      <TypingIndicator typingUsers={[mockUser1]} currentUserId="user-1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should display typing indicator for single user', () => {
    render(<TypingIndicator typingUsers={[mockUser1]} />);
    expect(screen.getByText('Typing')).toBeInTheDocument();
  });

  it('should display typing indicator for two users', () => {
    render(<TypingIndicator typingUsers={[mockUser1, mockUser2]} />);
    expect(screen.getByText('Typing')).toBeInTheDocument();
  });

  it('should display typing indicator for 3+ users', () => {
    const mockUser3 = {
      id: 'user-3',
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<TypingIndicator typingUsers={[mockUser1, mockUser2, mockUser3]} />);
    expect(screen.getByText('Typing')).toBeInTheDocument();
  });

  it('should display animated dots', () => {
    const { container } = render(<TypingIndicator typingUsers={[mockUser1]} />);
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });
});
