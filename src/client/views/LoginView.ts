// ---------------------------------------------------------------------------
// LoginView — NIP-07 Nostr login (signs in directly on this subdomain)
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import { authLoading, authError } from '../../signals';
import { S } from '../bridge';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from 'blazecn';
import { IconSpinner } from '../icons';
import { login } from '../api';

export class LoginView extends Component<{}, {}> {
  private async handleLogin() {
    authLoading.value = true;
    authError.value = '';

    try {
      // 1. Check for NIP-07 extension
      const nostr = (window as any).nostr;
      if (!nostr) {
        authError.value = 'No Nostr extension found. Install Alby, nos2x, or similar.';
        authLoading.value = false;
        return;
      }

      // 2. Get challenge token from server
      const tokenRes = await fetch('/api/auth/login-token', { credentials: 'include' });
      const { token: challenge } = await tokenRes.json();

      // 3. Sign with NIP-07 extension
      const unsigned = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: challenge,
      };
      const event = await nostr.signEvent(unsigned);

      if (!event?.id || !event?.pubkey || !event?.sig) {
        authError.value = 'Signer returned invalid event';
        authLoading.value = false;
        return;
      }

      // 4. Send signed event to server
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(event),
      });
      const data = await loginRes.json();

      if (data.ok) {
        // Cookie is set by server — just reload to pick it up
        window.location.reload();
      } else {
        authError.value = data.error || 'Login failed';
        authLoading.value = false;
      }
    } catch (e: any) {
      authError.value = e.message || 'Login failed';
      authLoading.value = false;
    }
  }

  render() {
    return createElement('div', {
      className: 'min-h-screen flex items-center justify-center bg-background relative overflow-hidden',
    },
      // Background decorations
      createElement('div', { className: 'absolute inset-0 overflow-hidden pointer-events-none' },
        createElement('div', {
          className: 'absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl',
          style: { background: 'oklch(0.55 0.25 270)' },
        }),
        createElement('div', {
          className: 'absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl',
          style: { background: 'oklch(0.60 0.20 150)' },
        }),
        createElement('div', {
          className: 'absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-8 blur-3xl',
          style: { background: 'oklch(0.65 0.15 30)' },
        }),
      ),

      // Login card
      createElement('div', { className: 'relative w-full max-w-md px-4' },
        createElement(Card, {
          className: 'border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl',
        },
          createElement(CardHeader, { className: 'text-center space-y-2' },
            createElement('div', { className: 'mx-auto size-14 rounded-2xl bg-primary flex items-center justify-center mb-2' },
              createElement('span', { className: 'text-2xl' }, '🍄'),
            ),
            createElement(CardTitle, { className: 'text-2xl' }, 'Sporeboard'),
            createElement(CardDescription, null, 'Sign in with your Nostr identity'),
          ),
          createElement(CardContent, { className: 'space-y-4' },
            // Error
            S(() => {
              const err = authError.value;
              if (!err) return null;
              return createElement('div', {
                className: 'text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2',
              }, err);
            }),
          ),
          createElement(CardFooter, null,
            S(() =>
              createElement(Button, {
                className: 'w-full',
                size: 'lg',
                disabled: authLoading.value,
                onClick: () => this.handleLogin(),
              },
                authLoading.value
                  ? createElement('span', { className: 'flex items-center gap-2' },
                      IconSpinner('size-4'),
                      'Signing in...',
                    )
                  : '🔑 Login with Nostr',
              ),
            ),
          ),
        ),
        // Footer
        createElement('p', {
          className: 'text-center text-xs text-muted-foreground mt-6',
        },
          'Powered by ',
          createElement('strong', { className: 'text-foreground/60' }, 'Spore'),
          ' · Bun + Hono + InfernoJS',
        ),
      ),
    );
  }
}
