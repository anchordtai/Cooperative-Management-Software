// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import VerifyAccount from './VerifyAccount';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const showVerificationPage = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <VerifyAccount />
  </MemoryRouter>
);

test('uses the email link token after the user confirms verification', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { message: 'Email verified.' } });
  showVerificationPage('/verify-account#token=example-token');
  expect(api.post).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
  await screen.findByText('Email verified.');
  expect(api.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'example-token' });
});

test('invited members set a password before their account activates', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { message: 'Account activated.' } });
  showVerificationPage('/verify-account#invite=example-invitation');

  fireEvent.change(screen.getByLabelText(/New password/), { target: { value: 'A-test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
  await screen.findByText('Account activated.');
  expect(api.post).toHaveBeenCalledWith('/auth/accept-invitation', {
    token: 'example-invitation', password: 'A-test-password'
  });
});
