import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeadsPage } from '../pages/LeadsPage.js';
import { FollowUpsPage } from '../pages/FollowUpsPage.js';
import { SurveysPage } from '../pages/SurveysPage.js';
import * as apiModule from '../lib/api.js';

describe('Phase 4A Frontend Operational Pages', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  it('renders LeadsPage with heading, search input, and new lead button', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LeadsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Lead Management/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search name, phone, city/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add lead/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/no leads in this view/i)).toBeInTheDocument();
    });
  });

  it('renders FollowUpsPage with timeframe tabs and follow-up tracker', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FollowUpsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /scheduled follow-ups/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overdue/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/all follow-ups up to date/i)).toBeInTheDocument();
    });
  });

  it('renders SurveysPage with site survey headers, filters, and schedule button', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SurveysPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(
      screen.getByRole('heading', { name: /site surveys & feasibility/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new site survey/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/no site surveys found in this view/i)).toBeInTheDocument();
    });
  });
});
