// ---------------------------------------------------------------------------
// LoginView — glassmorphic auth screen
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import { authLoading, authError } from '../../signals';
import { S } from '../bridge';
import { login } from '../api';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Input, Label, Badge,
} from 'blazecn';
import { IconSpinner } from '../icons';

export class LoginView extends Component<{}, {
  url: string;
  username: string;
  token: string;
}> {
  state = {
    url: localStorage.getItem('kb_last_url') || 'http://localhost:8080/jsonrpc.php',
    username: 'admin',
    token: '',
  };

  private async handleLogin() {
    const { url, username, token } = this.state;
    if (!url || !username || !token) return;
    localStorage.setItem('kb_last_url', url);
    await login(url, username, token);
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
              createElement('span', { className: 'text-2xl font-black text-primary-foreground' }, 'K'),
            ),
            createElement(CardTitle, { className: 'text-2xl' }, 'Kanboard'),
            createElement(CardDescription, null, 'Sign in to your Kanboard instance'),
          ),
          createElement(CardContent, { className: 'space-y-4' },
            // Server URL
            createElement('div', { className: 'space-y-2' },
              createElement(Label, { htmlFor: 'login-url' }, 'API Endpoint'),
              createElement(Input, {
                id: 'login-url',
                type: 'url',
                placeholder: 'http://localhost:8080/jsonrpc.php',
                value: this.state.url,
                onInput: (e: any) => this.setState({ url: e.target.value }),
                className: 'bg-background/50',
              }),
            ),
            // Username
            createElement('div', { className: 'space-y-2' },
              createElement(Label, { htmlFor: 'login-user' }, 'Username'),
              createElement(Input, {
                id: 'login-user',
                type: 'text',
                placeholder: 'admin',
                value: this.state.username,
                onInput: (e: any) => this.setState({ username: e.target.value }),
                className: 'bg-background/50',
              }),
            ),
            // API Token
            createElement('div', { className: 'space-y-2' },
              createElement(Label, { htmlFor: 'login-token' }, 'API Token'),
              createElement(Input, {
                id: 'login-token',
                type: 'password',
                placeholder: 'Your API token or password',
                value: this.state.token,
                onInput: (e: any) => this.setState({ token: e.target.value }),
                onKeyDown: (e: any) => { if (e.key === 'Enter') this.handleLogin(); },
                className: 'bg-background/50',
              }),
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
                      'Connecting...',
                    )
                  : 'Sign in',
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
