// ---------------------------------------------------------------------------
// LoginView — SSO-aware auth screen
// Reads mycelium_token cookie set by mycelium.social login
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import { authLoading, authError } from '../../signals';
import { S } from '../bridge';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from 'blazecn';
import { IconSpinner } from '../icons';

const MAIN_DOMAIN = location.hostname.replace(/^[^.]+\./, '');

export class LoginView extends Component<{}, {}> {
  private handleLogin() {
    // Redirect to mycelium.social for NIP-07 login
    // After login, the cookie is set on .mycelium.social and works here too
    window.location.href = `https://${MAIN_DOMAIN}`;
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
              createElement('span', { className: 'text-2xl font-black text-primary-foreground' }, '🍄'),
            ),
            createElement(CardTitle, { className: 'text-2xl' }, 'Sporeboard'),
            createElement(CardDescription, null, 'Sign in with your Mycelium account'),
          ),
          createElement(CardContent, { className: 'space-y-4' },
            createElement('p', { className: 'text-sm text-muted-foreground text-center' },
              'Sporeboard uses your Nostr identity from ',
              createElement('strong', null, MAIN_DOMAIN),
              '. Log in once and access all Mycelium services.',
            ),
            // Error
            S(() => {
              const err = authError.value;
              if (!err) return null;
              return createElement('div', {
                className: 'text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2',
              }, err);
            }),
          ),
          createElement(CardFooter, { className: 'flex flex-col gap-3' },
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
                      'Checking session...',
                    )
                  : `Login at ${MAIN_DOMAIN}`,
              ),
            ),
            createElement('p', { className: 'text-xs text-muted-foreground text-center' },
              'Already logged in? ',
              createElement('a', {
                href: '#',
                className: 'text-primary underline',
                onClick: (e: any) => { e.preventDefault(); location.reload(); },
              }, 'Refresh this page'),
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
