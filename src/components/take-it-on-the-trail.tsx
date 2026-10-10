"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "./ui/button";

export function TakeItOnTheTrail({ audio }: { audio: string | null }) {
  return (
    <div>
      <p className="mb-3 text-ink-muted">
        On the trail, keep the phone in your pocket. Save the audio for the drive to the road head, and print this page:
        it fits on one sheet, with the day-by-day, permits and last signal.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => window.print()}>
          <Printer aria-hidden /> Print the one-page plan
        </Button>
        {audio && (
          <Button asChild variant="outline">
            <a href={audio} download>
              <Download aria-hidden /> Download the audio (MP3)
            </a>
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">Tip: choose &ldquo;Save as PDF&rdquo; in the print dialog to keep it on your phone offline.</p>
    </div>
  );
}
