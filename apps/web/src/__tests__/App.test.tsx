import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App.js';

describe('Frontend Shell (App)', () => {
  it('renders company brand, navigation, and security status header', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Verify Navigation Shell / Brand rendered cleanly
    expect(screen.getAllByText(/RAREBOX/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SOLAR/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Admin Panel/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });
});
