"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, Switch } from "../../kit";
import { Section } from "./Section";

// The motion tokens of a pane (F-TPL-05): seven durations on the standard easing and four easings
// over the slow duration, run once and replayed on demand, and the spec's spring on a live switch.

const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"] as const;

export function MotionDemos({ vars }: { vars: Readonly<Record<string, string>> }) {
  const [run, setRun] = useState(0);
  return (
    <Section title="Motion">
      <div className="sink-motion-head">
        <p className="sink-note kit-t-body-sm">
          Durations run on the standard easing; easings run over the slow duration.
        </p>
        <Button
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" />}
          onPress={() => setRun((count) => count + 1)}
        >
          Replay
        </Button>
      </div>
      <ul className="sink-tracks">
        {DURATIONS.map((name) => (
          <Track
            key={name}
            token={`duration-${name}`}
            label={name}
            printed={vars[`--duration-${name}`] ?? ""}
            duration={`var(--duration-${name})`}
            easing="var(--ease-standard)"
            run={run}
          />
        ))}
        {EASINGS.map((name) => (
          <Track
            key={name}
            token={`ease-${name}`}
            label={name}
            printed={vars[`--ease-${name}`] ?? ""}
            duration="var(--duration-slow)"
            easing={`var(--ease-${name})`}
            run={run}
          />
        ))}
      </ul>
      <div className="sink-spring">
        <p className="kit-mono kit-t-caption">
          spring · {vars["--spring-duration"]} s · bounce {vars["--spring-bounce"]}
        </p>
        <Switch label="Follow the tide" />
      </div>
    </Section>
  );
}

function Track({
  token,
  label,
  printed,
  duration,
  easing,
  run,
}: {
  token: string;
  label: string;
  printed: string;
  duration: string;
  easing: string;
  run: number;
}) {
  return (
    <li className="sink-track-row kit-mono kit-t-caption" data-token={token}>
      <span>{label}</span>
      <span data-printed="">{printed}</span>
      <span className="sink-track" aria-hidden="true">
        <span
          key={run}
          data-runner=""
          className="sink-runner"
          style={{ animationDuration: duration, animationTimingFunction: easing }}
        >
          <span className="sink-dot" />
        </span>
      </span>
    </li>
  );
}
