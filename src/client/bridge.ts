// ---------------------------------------------------------------------------
// SignalBridge — bridges @preact/signals-core reactivity into Inferno
// Extracted as shared infrastructure so every view can use S()
// ---------------------------------------------------------------------------

import { Component } from 'inferno';
import { createElement } from 'inferno-create-element';
import { effect } from '@preact/signals-core';

export class SignalBridge extends Component<{ children: () => any }, {}> {
  private dispose: (() => void) | null = null;
  private _mounted = false;

  componentDidMount() {
    this._mounted = true;
    this.dispose = effect(() => {
      this.props.children();
      if (this._mounted) this.forceUpdate();
    });
  }

  componentWillUnmount() {
    this._mounted = false;
    this.dispose?.();
  }

  render() {
    return this.props.children();
  }
}

/**
 * S() — shorthand for creating a SignalBridge.
 * Usage: S(() => createElement('span', null, count.value))
 * Only the subtree returned by fn re-renders when its tracked signals change.
 */
export function S(fn: () => any) {
  return createElement(SignalBridge, { children: fn });
}
