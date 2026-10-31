import Link from "next/link";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

export default function NotFound() {
  return (
    <PageFrame statusLeft="dyelot ~/404">
      <TerminalWindow title="404.log" className="mx-auto my-auto w-full max-w-xl">
        <div className="space-y-3">
          <Prompt>cat page</Prompt>
          <h1 className="font-mono text-xl font-semibold tracking-tight">404: no such page</h1>
          <Prompt kind="comment">check the address, or start again from the home page</Prompt>
          <Link href="/" className="inline-block pt-1 font-mono text-sm text-accent-madder">
            <span aria-hidden="true">$ </span>cd ~
          </Link>
        </div>
      </TerminalWindow>
    </PageFrame>
  );
}
