"use client";

import { Component, type ReactNode } from "react";
import type { TemplateId } from "@/features/studio/view";
import { Button } from "./kit";
import { TEMPLATE_LINES } from "./templates/load";

// The canvas's error boundary for a template that could not load (docs/specs/06-gallery.md, R6-33
// and 13.3). It sits above the keyed `<ViewTransition>`, so a template switch never mounts a new
// one. Its fallback is a sentence and "Try again", never a raw error (I-M6-04). The alert is for
// one template: "Try again", or a switch to another template, clears it and forgets that template's
// lazy component, so it mounts afresh and its loader runs again the next time it shows (the loader
// forgot its failure already; F-TPL6-05, F-TPL6-07).

type Props = {
  children: ReactNode;
  /** The template the canvas shows. */
  shown: TemplateId;
  /** Forgets a template that could not load, so that it loads afresh the next time it shows. */
  forget: (id: TemplateId) => void;
};

export class TemplateBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  /** The template the alert is for: set when the error is caught, cleared with the alert. */
  private failedId: TemplateId | null = null;

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // The props are those of the render that failed, so `shown` is the template that could not load.
    this.failedId = this.props.shown;
  }

  componentDidUpdate(): void {
    if (this.state.failed && this.failedId !== null && this.props.shown !== this.failedId) {
      this.clear();
    }
  }

  private readonly clear = (): void => {
    const failed = this.failedId;
    this.failedId = null;
    if (failed !== null) this.props.forget(failed);
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-template-failed="" className="canvas-note">
        <p className="kit-t-body">{TEMPLATE_LINES.failed}</p>
        <Button variant="secondary" onPress={this.clear}>
          {TEMPLATE_LINES.retry}
        </Button>
      </div>
    );
  }
}
