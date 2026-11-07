"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./kit";
import { TEMPLATE_LINES } from "./templates/load";

// The canvas's error boundary for a template that could not load (docs/specs/06-gallery.md, R6-33
// and 13.3). It sits above the keyed `<ViewTransition>`, so a template switch never mounts a new
// one. Its fallback is a sentence and "Try again", never a raw error (I-M6-04): "Try again" calls
// `onRetry`, which forgets the failed template's lazy component, and resets the boundary, so the
// template mounts afresh and its loader runs again (the loader forgot its failure already).

type Props = { children: ReactNode; onRetry: () => void };

export class TemplateBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  private readonly retry = (): void => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-template-failed="" className="canvas-note">
        <p className="kit-t-body">{TEMPLATE_LINES.failed}</p>
        <Button variant="secondary" onPress={this.retry}>
          {TEMPLATE_LINES.retry}
        </Button>
      </div>
    );
  }
}
